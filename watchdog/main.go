package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
)

type watchdogConfig struct {
	HealthURL      string `json:"healthUrl"`
	PollSeconds    int    `json:"pollSeconds"`
	StallSeconds   int    `json:"stallSeconds"`
	RestartCommand string `json:"restartCommand"`
}

type rootConfig struct {
	Watchdog watchdogConfig `json:"watchdog"`
	Ops      struct {
		AlertWebhookURL string `json:"alertWebhookUrl"`
	} `json:"ops"`
}

type healthReport struct {
	Status       string `json:"status"`
	LastTickUnix int64  `json:"lastTickUnix"`
}

func main() {
	cfg, err := loadConfig(configPath())
	if err != nil {
		log.Fatal(err)
	}

	alertURL := firstNonEmpty(os.Getenv("ALERT_WEBHOOK_URL"), cfg.Ops.AlertWebhookURL)
	wd := cfg.Watchdog
	log.Printf("watchdog polling %s every %ds (stall threshold %ds)", wd.HealthURL, wd.PollSeconds, wd.StallSeconds)

	client := &http.Client{Timeout: 5 * time.Second}
	cooldown := time.Duration(wd.StallSeconds) * time.Second
	ticker := time.NewTicker(time.Duration(wd.PollSeconds) * time.Second)
	defer ticker.Stop()

	var lastRestart time.Time
	for range ticker.C {
		reason := probe(client, wd)
		if reason == "" {
			continue
		}
		log.Printf("unhealthy: %s", reason)
		alert(client, alertURL, "helios unhealthy: "+reason)

		if time.Since(lastRestart) < cooldown {
			log.Print("restart cooldown active, skipping")
			continue
		}
		if err := restart(wd.RestartCommand); err != nil {
			log.Printf("restart failed: %v", err)
			alert(client, alertURL, "helios restart failed: "+err.Error())
			continue
		}
		lastRestart = time.Now()
		log.Print("restart issued")
		alert(client, alertURL, "helios restart issued")
	}
}

func probe(client *http.Client, wd watchdogConfig) string {
	resp, err := client.Get(wd.HealthURL)
	if err != nil {
		return "health unreachable: " + err.Error()
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Sprintf("health status %d", resp.StatusCode)
	}
	var h healthReport
	if err := json.NewDecoder(resp.Body).Decode(&h); err != nil {
		return "health decode: " + err.Error()
	}
	if h.LastTickUnix > 0 {
		if age := time.Now().Unix() - h.LastTickUnix; age > int64(wd.StallSeconds) {
			return fmt.Sprintf("stalled: last tick %ds ago", age)
		}
	}
	return ""
}

func restart(command string) error {
	if strings.TrimSpace(command) == "" {
		return fmt.Errorf("no restart command configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "sh", "-c", command)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func alert(client *http.Client, url, message string) {
	if url == "" {
		return
	}
	body, _ := json.Marshal(map[string]string{"text": message})
	req, err := http.NewRequest(http.MethodPost, url, strings.NewReader(string(body)))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("alert delivery failed: %v", err)
		return
	}
	resp.Body.Close()
}

func loadConfig(path string) (rootConfig, error) {
	var cfg rootConfig
	data, err := os.ReadFile(path)
	if err != nil {
		return cfg, err
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return cfg, err
	}
	if cfg.Watchdog.HealthURL == "" {
		return cfg, fmt.Errorf("watchdog.healthUrl is required")
	}
	if cfg.Watchdog.PollSeconds <= 0 {
		cfg.Watchdog.PollSeconds = 15
	}
	if cfg.Watchdog.StallSeconds <= 0 {
		cfg.Watchdog.StallSeconds = 120
	}
	return cfg, nil
}

func configPath() string {
	return firstNonEmpty(os.Getenv("HELIOS_CONFIG"), "config.json")
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

import { loadConfig } from "../config/index.ts";
import { CmcSensor } from "./index.ts";

const cfg = loadConfig();
const state = await new CmcSensor(cfg).read();
console.log(JSON.stringify(state, null, 2));

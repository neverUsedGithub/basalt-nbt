import * as NBT from "../src";
import * as fs from "node:fs/promises";
import { stringifyByte } from "../src/util";

const fileBytes = await fs.readFile("test/bigtest.nbt");
const parsed = NBT.parseNBT(new Uint8Array(fileBytes));
const value = NBT.parseSNBT(parsed.stringify());
console.log(value.stringify());

// console.log(NBT.parseSNBT(`{ numberValue: 3.123d, stringValue: "hi", list: [B; true, false, false] }`));

// const data = NBT.parseSNBT(`{hello: { world: 123b, arr: [I; 1b, 3b, 5b] } }`);
// const dumped = NBT.dump(data);

// const parsed = NBT.parseNBT(dumped);
// console.log(parsed.stringify());

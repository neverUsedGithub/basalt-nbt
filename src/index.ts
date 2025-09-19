export * from "./tags";
import type { Tag } from "./tags";

import { SNBTParser } from "./parser/snbt";
import { NBTParser } from "./parser/nbt";
import { NBTDumper } from "./dump";

export function parseSNBT(data: string): Tag {
  return new SNBTParser(data).parse();
}

export function parseNBT(data: Uint8Array): Tag {
  return new NBTParser(data).parse();
}

export function dump(tag: Tag): Uint8Array {
  return new NBTDumper(tag).dump();
}
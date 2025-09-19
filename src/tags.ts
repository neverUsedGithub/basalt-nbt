import { stringifyTextEscaped, VALID_QUOTELESS_KEY_RE, VALID_QUOTELESS_STRING_RE } from "./util";

export const enum Tags {
  TAG_End = 0x00,
  TAG_Byte = 0x01,
  TAG_Short = 0x02,
  TAG_Int = 0x03,
  TAG_Long = 0x04,
  TAG_Float = 0x05,
  TAG_Double = 0x06,
  TAG_Byte_Array = 0x07,
  TAG_String = 0x08,
  TAG_List = 0x09,
  TAG_Compound = 0x0a,
  TAG_Int_Array = 0x0b,
  TAG_Long_Array = 0x0c,
}

export abstract class Tag {
  abstract stringify(): string;
  abstract getId(): Tags;
}

export abstract class LiteralTag<T> extends Tag {
  constructor(protected value: T) {
    super();
  }

  getValue(): T {
    return this.value;
  }
}

export class ByteTag extends LiteralTag<number> {
  stringify(): string {
    return `${this.value}b`;
  }

  getId(): Tags {
    return Tags.TAG_Byte;
  }
}

export class ShortTag extends LiteralTag<number> {
  stringify(): string {
    return `${this.value}s`;
  }

  getId(): Tags {
    return Tags.TAG_Short;
  }
}

export class IntTag extends LiteralTag<number> {
  stringify(): string {
    return `${this.value}`;
  }

  getId(): Tags {
    return Tags.TAG_Int;
  }
}

export class LongTag extends LiteralTag<bigint> {
  stringify(): string {
    return `${this.value}l`;
  }

  getId(): Tags {
    return Tags.TAG_Long;
  }
}

export class FloatTag extends LiteralTag<number> {
  stringify(): string {
    return `${this.value}f`;
  }

  getId(): Tags {
    return Tags.TAG_Float;
  }
}

export class DoubleTag extends LiteralTag<number> {
  stringify(): string {
    return `${this.value}d`;
  }

  getId(): Tags {
    return Tags.TAG_Double;
  }
}

export class StringTag extends LiteralTag<string> {
  stringify(): string {
    return stringifyTextEscaped(this.value, VALID_QUOTELESS_STRING_RE);
  }

  getId(): Tags {
    return Tags.TAG_String;
  }
}

export class CompoundTag extends Tag {
  private items: Map<string, Tag>;

  constructor(items: Record<string, Tag>);
  constructor(items: Map<string, Tag>);
  constructor(items: Record<string, Tag> | Map<string, Tag>) {
    super();
    this.items = items instanceof Map ? items : new Map(Object.entries(items));
  }

  get<T extends Tag = Tag>(name: string): T | null {
    // @ts-expect-error
    return this.items.get(name) ?? null;
  }

  delete(name: string) {
    this.items.delete(name);
  }

  put(name: string, tag: Tag) {
    this.items.set(name, tag);
  }

  list(): string[] {
    return Array.from(this.items.keys());
  }

  stringify(): string {
    let stringified = "{";

    for (const [key, value] of this.items) {
      if (stringified.length > 1) stringified += ", ";
      stringified += `${stringifyTextEscaped(key, VALID_QUOTELESS_KEY_RE)}: ${value.stringify()}`;
    }

    return stringified + "}";
  }

  getId(): Tags {
    return Tags.TAG_Compound;
  }
}

export class ListTag extends Tag {
  constructor(private items: Tag[]) {
    super();
  }

  stringify(): string {
    return `[${this.items.map((item) => item.stringify()).join(", ")}]`;
  }

  getValues() {
    return this.items;
  }

  getId(): Tags {
    return Tags.TAG_List;
  }
}

export class ByteArrayTag extends Tag {
  constructor(private items: number[]) {
    super();
  }

  stringify(): string {
    return `[B; ${this.items.map((item) => `${item}b`).join(", ")}]`;
  }

  getValues() {
    return this.items;
  }

  getId(): Tags {
    return Tags.TAG_Byte_Array;
  }
}

export class IntArrayTag extends Tag {
  constructor(private items: number[]) {
    super();
  }

  stringify(): string {
    return `[I; ${this.items.map((item) => `${item}`).join(", ")}]`;
  }

  getValues() {
    return this.items;
  }

  getId(): Tags {
    return Tags.TAG_Int_Array;
  }
}

export class LongArrayTag extends Tag {
  constructor(private items: bigint[]) {
    super();
  }

  stringify(): string {
    return `[L; ${this.items.map((item) => `${item}l`).join(", ")}]`;
  }

  getValues() {
    return this.items;
  }

  getId(): Tags {
    return Tags.TAG_Long_Array;
  }
}

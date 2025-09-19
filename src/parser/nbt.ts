import { stringifyByte } from "../util";
import * as tags from "../tags";

export class NBTParser {
  private pos: number = 0;
  private dataView: DataView;

  constructor(private data: Uint8Array) {
    this.dataView = new DataView(data.buffer);
  }

  private expectByte(value?: number): number {
    if (this.pos >= this.data.length) throw new Error(`unexpected end of file`);
    if (value !== undefined && value !== this.data[this.pos])
      throw new Error(`expected byte ${stringifyByte(value)}, found ${stringifyByte(this.data[this.pos])}`);

    return this.data[this.pos++];
  }

  private readInteger<T extends 2 | 4 | 8>(bytes: T): T extends 8 ? bigint : number {
    if (this.pos + bytes >= this.data.length) throw new Error("unexpected end of file");
    this.pos += bytes;

    switch (bytes) {
      case 2:
        // @ts-expect-error
        return this.dataView.getInt16(this.pos - bytes);
      case 4:
        // @ts-expect-error
        return this.dataView.getInt32(this.pos - bytes);
      case 8:
        // @ts-expect-error
        return this.dataView.getBigInt64(this.pos - bytes);
    }
  }

  private readUnsignedInteger<T extends 2 | 4 | 8>(bytes: T): T extends 8 ? bigint : number {
    if (this.pos + bytes >= this.data.length) throw new Error("unexpected end of file");
    this.pos += bytes;

    switch (bytes) {
      case 2:
        // @ts-expect-error
        return this.dataView.getUint16(this.pos - bytes);
      case 4:
        // @ts-expect-error
        return this.dataView.getUint32(this.pos - bytes);
      case 8:
        // @ts-expect-error
        return this.dataView.getBigUint64(this.pos - bytes);
    }
  }

  private readFLoat(bytes: 4 | 8): number {
    if (this.pos + bytes >= this.data.length) throw new Error("unexpected end of file");
    this.pos += bytes;

    switch (bytes) {
      case 4:
        return this.dataView.getFloat32(this.pos - bytes);
      case 8:
        return this.dataView.getFloat64(this.pos - bytes);
    }
  }

  private parseByteArray(): tags.ByteArrayTag {
    const length = this.readInteger(4);
    if (this.pos + length >= this.data.length) throw new Error("unexpected end of file");
    this.pos += length;

    return new tags.ByteArrayTag(Array.from(this.data.slice(this.pos - length, this.pos)));
  }

  private parseIntArray(): tags.IntArrayTag {
    const length = this.readInteger(4);
    const items: number[] = [];

    for (let i = 0; i < length; i++) items.push(this.readInteger(4));

    return new tags.IntArrayTag(items);
  }

  private parseLongArray(): tags.LongArrayTag {
    const length = this.readInteger(4);
    const items: bigint[] = [];

    for (let i = 0; i < length; i++) items.push(this.readInteger(8));

    return new tags.LongArrayTag(items);
  }

  private parseString(): tags.StringTag {
    const length = this.readUnsignedInteger(2);

    if (this.pos + length >= this.data.length) throw new Error("unexpected end of file");
    this.pos += length;

    return new tags.StringTag(new TextDecoder().decode(this.data.slice(this.pos - length, this.pos)));
  }

  private parseList(): tags.ListTag {
    const tagId = this.expectByte();
    const length = this.readInteger(4);
    const items: tags.Tag[] = [];

    let isDynamicArray = true;

    for (let i = 0; i < length; i++) {
      const item = this.parseFromTagType(tagId);

      items.push(item);
      if (!(item instanceof tags.CompoundTag) || item.list().length !== 1 || item.list()[0] !== "")
        isDynamicArray = false;
    }

    if (isDynamicArray) {
      return new tags.ListTag(items.map((it) => (it as tags.CompoundTag).get("")!));
    }

    return new tags.ListTag(items);
  }

  private parseCompound(): tags.CompoundTag {
    const items: Map<string, tags.Tag> = new Map();

    while (true) {
      const tagId = this.expectByte();
      if (tagId === tags.Tags.TAG_End) break;

      const name = this.parseString();
      const value = this.parseFromTagType(tagId);

      if (items.has(name.getValue())) throw new Error(`compound already contains tag named '${name.getValue()}'`);
      items.set(name.getValue(), value);
    }

    return new tags.CompoundTag(items);
  }

  private parseFromTagType(tagId: number): tags.Tag {
    if (tagId === tags.Tags.TAG_Byte) return new tags.ByteTag(this.expectByte());
    if (tagId === tags.Tags.TAG_Short) return new tags.ShortTag(this.readInteger(2));
    if (tagId === tags.Tags.TAG_Int) return new tags.IntTag(this.readInteger(4));
    if (tagId === tags.Tags.TAG_Long) return new tags.LongTag(this.readInteger(8));

    if (tagId === tags.Tags.TAG_Float) return new tags.FloatTag(this.readFLoat(4));
    if (tagId === tags.Tags.TAG_Double) return new tags.DoubleTag(this.readFLoat(8));

    if (tagId === tags.Tags.TAG_Byte_Array) return this.parseByteArray();
    if (tagId === tags.Tags.TAG_Int_Array) return this.parseIntArray();
    if (tagId === tags.Tags.TAG_Long_Array) return this.parseLongArray();

    if (tagId === tags.Tags.TAG_String) return this.parseString();

    if (tagId === tags.Tags.TAG_List) return this.parseList();
    if (tagId === tags.Tags.TAG_Compound) return this.parseCompound();

    throw new Error(`cannot parse tag id '${stringifyByte(tagId)}'`);
  }

  parse(): tags.Tag {
    const tagId = this.expectByte();
    if (tagId === tags.Tags.TAG_End) throw new Error(`invalid root tag '${stringifyByte(tagId)}'`);

    const name = this.parseString();
    const root = new tags.CompoundTag(new Map([[name.getValue(), this.parseFromTagType(tagId)]]));

    return root;
  }
}

import * as tags from "./tags";
import { stringifyByte } from "./util";

class DumpContext {
  private buffer: Uint8Array = new Uint8Array(256);
  private pointer: number = 0;

  private view: DataView = new DataView(this.buffer.buffer);

  private growBuffer(bytes: number) {
    if (this.pointer + bytes >= this.buffer.length) {
      const newBuffer = new Uint8Array(this.buffer.length * 2);
      newBuffer.set(this.buffer);

      this.buffer = newBuffer;
      this.view = new DataView(this.buffer.buffer, 0, 0);
    }
  }

  dumpInteger<T extends 2 | 4 | 8>(bytes: T, value: T extends 8 ? bigint : number): void {
    this.growBuffer(bytes);
    this.pointer += bytes;

    switch (bytes) {
      case 2:
        // @ts-expect-error
        return this.view.setInt16(this.pointer - bytes, value);

      case 4:
        // @ts-expect-error
        return this.view.setInt32(this.pointer - bytes, value);

      case 8:
        // @ts-expect-error
        return this.view.setBigInt64(this.pointer - bytes, value);
    }
  }

  dumpUnsignedInteger<T extends 2 | 4 | 8>(bytes: T, value: T extends 8 ? bigint : number): void {
    this.growBuffer(bytes);
    this.pointer += bytes;

    switch (bytes) {
      case 2:
        // @ts-expect-error
        return this.view.setUint16(this.pointer - bytes, value);

      case 4:
        // @ts-expect-error
        return this.view.setUint32(this.pointer - bytes, value);

      case 8:
        // @ts-expect-error
        return this.view.setBigUint64(this.pointer - bytes, value);
    }
  }

  dumpFloat(bytes: 4 | 8, value: number): void {
    this.growBuffer(bytes);
    this.pointer += bytes;

    switch (bytes) {
      case 4:
        return this.view.setFloat32(this.pointer - bytes, value);

      case 8:
        return this.view.setFloat64(this.pointer - bytes, value);
    }
  }

  dumpRaw(bytes: Uint8Array) {
    this.growBuffer(bytes.length);
    this.buffer.set(bytes, this.pointer);
    this.pointer += bytes.length;
  }

  dumpString(text: string) {
    const bytes = new TextEncoder().encode(text);

    this.dumpUnsignedInteger(2, bytes.length);
    this.dumpRaw(bytes);
  }

  dumpByte(byte: number) {
    this.growBuffer(1);
    this.buffer[this.pointer++] = byte;
  }

  final() {
    return this.buffer.slice(0, this.pointer);
  }
}

export class NBTDumper {
  constructor(private root: tags.Tag) {}

  private dumpByteArray(ctx: DumpContext, tag: tags.ByteArrayTag) {
    ctx.dumpInteger(4, tag.getValues().length);
    ctx.dumpRaw(new Uint8Array(tag.getValues()));
  }

  private dumpIntArray(ctx: DumpContext, tag: tags.IntArrayTag) {
    const values = tag.getValues();

    ctx.dumpInteger(4, values.length);
    for (let i = 0; i < values.length; i++) ctx.dumpInteger(4, values[i]);
  }

  private dumpLongArray(ctx: DumpContext, tag: tags.LongArrayTag) {
    const values = tag.getValues();

    ctx.dumpInteger(4, values.length);
    for (let i = 0; i < values.length; i++) ctx.dumpInteger(8, values[i]);
  }

  private dumpString(ctx: DumpContext, tag: tags.StringTag) {
    ctx.dumpString(tag.getValue());
  }

  private dumpList(ctx: DumpContext, tag: tags.ListTag) {
    const values = tag.getValues();

    let valueId = tags.Tags.TAG_End;
    let sameType = true;

    if (values.length > 0) {
      valueId = values[0].getId();

      for (let i = 1; i < values.length; i++) {
        if (values[i].getId() !== valueId) {
          sameType = false;
          break;
        }
      }
    }

    if (sameType) {
      ctx.dumpByte(valueId);
      ctx.dumpInteger(4, values.length);

      for (let i = 0; i < values.length; i++) this.dumpTagValue(ctx, values[i]);
    } else {
      ctx.dumpByte(tags.Tags.TAG_Compound);
      ctx.dumpInteger(4, values.length);

      for (let i = 0; i < values.length; i++) {
        this.dumpTagValue(ctx, new tags.CompoundTag(new Map([["", values[i]]])));
      }
    }
  }

  private dumpCompound(ctx: DumpContext, tag: tags.CompoundTag) {
    const keys = tag.list();

    for (let i = 0; i < keys.length; i++) {
      const value = tag.get(keys[i])!;
      ctx.dumpByte(value.getId());
      ctx.dumpString(keys[i]);
      this.dumpTagValue(ctx, value);
    }

    ctx.dumpByte(tags.Tags.TAG_End);
  }

  private dumpTagValue(ctx: DumpContext, tag: tags.Tag): void {
    if (tag instanceof tags.ByteTag) return ctx.dumpByte(tag.getValue());
    if (tag instanceof tags.ShortTag) return ctx.dumpInteger(2, tag.getValue());
    if (tag instanceof tags.IntTag) return ctx.dumpInteger(4, tag.getValue());
    if (tag instanceof tags.LongTag) return ctx.dumpInteger(8, tag.getValue());

    if (tag instanceof tags.FloatTag) return ctx.dumpFloat(4, tag.getValue());
    if (tag instanceof tags.DoubleTag) return ctx.dumpFloat(8, tag.getValue());

    if (tag instanceof tags.ByteArrayTag) return this.dumpByteArray(ctx, tag);
    if (tag instanceof tags.IntArrayTag) return this.dumpIntArray(ctx, tag);
    if (tag instanceof tags.LongArrayTag) return this.dumpLongArray(ctx, tag);

    if (tag instanceof tags.StringTag) return this.dumpString(ctx, tag);

    if (tag instanceof tags.ListTag) return this.dumpList(ctx, tag);
    if (tag instanceof tags.CompoundTag) return this.dumpCompound(ctx, tag);

    throw new Error(`cannot dump tag id '${stringifyByte(tag.getId())}'`);
  }

  private dumpTag(ctx: DumpContext, tag: tags.Tag) {
    ctx.dumpByte(tag.getId());
    this.dumpTagValue(ctx, tag);
  }

  dump(): Uint8Array {
    const ctx = new DumpContext();

    if (this.root instanceof tags.CompoundTag && this.root.list().length === 1) {
      const name = this.root.list()[0];

      ctx.dumpByte(this.root.getId());
      ctx.dumpString(name);

      this.dumpTagValue(ctx, this.root.get(name)!);
    } else {
      ctx.dumpByte(tags.Tags.TAG_Compound);
      ctx.dumpString("");

      this.dumpTag(ctx, this.root);
    }

    return ctx.final();
  }
}

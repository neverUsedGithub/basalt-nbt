import * as tags from "../tags";

enum TokenKind {
  EOF = "EOF",
  NUMBER = "NUMBER",
  SUFFIX = "SUFFIX",
  STRING = "STRING",
  BOOLEAN = "BOOLEAN",
  DELIMITER = "DELIMITER",
}

class Token {
  constructor(
    public kind: TokenKind,
    public value: string,
  ) {}
}

const CONSTANT_TOKENS = {
  ["{".charCodeAt(0)]: TokenKind.DELIMITER,
  ["}".charCodeAt(0)]: TokenKind.DELIMITER,
  ["[".charCodeAt(0)]: TokenKind.DELIMITER,
  ["]".charCodeAt(0)]: TokenKind.DELIMITER,
  [":".charCodeAt(0)]: TokenKind.DELIMITER,
  [",".charCodeAt(0)]: TokenKind.DELIMITER,
  [";".charCodeAt(0)]: TokenKind.DELIMITER,
};

const NUMBER_SUFFIXES = [
  "b".charCodeAt(0),
  "B".charCodeAt(0),
  "s".charCodeAt(0),
  "S".charCodeAt(0),
  "i".charCodeAt(0),
  "I".charCodeAt(0),
  "l".charCodeAt(0),
  "L".charCodeAt(0),
  "f".charCodeAt(0),
  "F".charCodeAt(0),
  "d".charCodeAt(0),
  "d".charCodeAt(0),
];

const SKIP_CHARS = [" ".charCodeAt(0), "\t".charCodeAt(0), "\n".charCodeAt(0), "\r".charCodeAt(0)];

const NUMBER_SIGN_PLUS = "+".charCodeAt(0);
const NUMBER_SIGN_MINUS = "-".charCodeAt(0);

const NUMBERS_START = "0".charCodeAt(0);
const NUMBERS_END = "9".charCodeAt(0);

const LOWERCASE_START = "a".charCodeAt(0);
const LOWERCASE_END = "z".charCodeAt(0);

const UPPERCASE_START = "A".charCodeAt(0);
const UPPERCASE_END = "Z".charCodeAt(0);

const IDENTIFIER_OTHER = ["_".charCodeAt(0), "-".charCodeAt(0), ".".charCodeAt(0), "+".charCodeAt(0)];

function isIdentifierChar(charCode: number) {
  return (
    (charCode >= LOWERCASE_START && charCode <= LOWERCASE_END) ||
    (charCode >= UPPERCASE_START && charCode <= UPPERCASE_END) ||
    IDENTIFIER_OTHER.includes(charCode)
  );
}

const FLOAT_SEPARATOR = ".".charCodeAt(0);

class Lexer {
  private pos: number = 0;
  private lastNumber: number = -777;

  constructor(private source: string) {}

  next(): Token {
    if (this.pos >= this.source.length) return new Token(TokenKind.EOF, "");

    const charCode = this.source.charCodeAt(this.pos);

    if (SKIP_CHARS.includes(charCode)) {
      this.pos++;
      return this.next();
    }

    if (CONSTANT_TOKENS[charCode]) {
      return new Token(CONSTANT_TOKENS[charCode], this.source[this.pos++]);
    }

    if (this.lastNumber === this.pos - 1 && NUMBER_SUFFIXES.includes(charCode)) {
      return new Token(TokenKind.SUFFIX, this.source[this.pos++]);
    }

    if (
      charCode === NUMBER_SIGN_PLUS ||
      charCode === NUMBER_SIGN_MINUS ||
      (charCode >= NUMBERS_START && charCode <= NUMBERS_END)
    ) {
      let content = this.source[this.pos++];
      let isFloat = false;

      while (
        (this.source.charCodeAt(this.pos) >= NUMBERS_START && this.source.charCodeAt(this.pos) <= NUMBERS_END) ||
        (!isFloat && this.source.charCodeAt(this.pos) === FLOAT_SEPARATOR)
      ) {
        if (this.source.charCodeAt(this.pos) === FLOAT_SEPARATOR) {
          isFloat = true;
        }

        content += this.source[this.pos++];
      }

      this.lastNumber = this.pos - 1;
      return new Token(TokenKind.NUMBER, content);
    }

    if (isIdentifierChar(charCode)) {
      const start = this.pos;

      while (isIdentifierChar(this.source.charCodeAt(this.pos))) {
        this.pos++;
      }

      const value = this.source.substring(start, this.pos);

      return new Token(value === "true" || value === "false" ? TokenKind.BOOLEAN : TokenKind.STRING, value);
    }

    if (this.source[this.pos] === '"' || this.source[this.pos] === "'") {
      const opener = this.source[this.pos++];
      let content = "";

      charLoop: while (true) {
        if (this.pos >= this.source.length) throw new Error("unexpected end of file");

        if (this.source[this.pos] === "\\") {
          if (this.pos + 1 >= this.source.length) throw new Error("unexepected end of file");

          switch (this.source[this.pos + 1]) {
            case '"':
            case "'":
              content += opener;
              this.pos += 2;
              continue charLoop;
          }
        }

        if (this.source[this.pos] === opener) break;

        content += this.source[this.pos++];
      }

      this.pos++;

      return new Token(TokenKind.STRING, content);
    }

    throw new Error(`unexpected character '${this.source[this.pos]}'`);
  }
}

export class SNBTParser {
  private lexer: Lexer;
  private current: Token;

  constructor(private source: string) {
    this.lexer = new Lexer(this.source);
    this.current = this.lexer.next();
  }

  private matches(kind: TokenKind, value?: string): boolean {
    return this.current.kind === kind && (!value || this.current.value === value);
  }

  private eat(kind: TokenKind, value?: string): Token {
    if (!this.matches(kind, value))
      throw new Error(
        `expected token '${kind}'${value ? ` with value '${value}'` : ""} but got '${this.current.value}'`,
      );

    const curr = this.current;
    this.current = this.lexer.next();

    return curr;
  }

  private parseCompound(): tags.CompoundTag {
    const items: Map<string, tags.Tag> = new Map();
    let first = true;

    this.eat(TokenKind.DELIMITER, "{");
    while (!this.matches(TokenKind.DELIMITER, "}")) {
      if (!first) this.eat(TokenKind.DELIMITER, ",");
      first = false;

      const key = this.eat(TokenKind.STRING);
      this.eat(TokenKind.DELIMITER, ":");
      const value = this.parseItem();

      items.set(key.value, value);
    }
    this.eat(TokenKind.DELIMITER, "}");

    return new tags.CompoundTag(items);
  }

  private parseList(): tags.Tag {
    const items: unknown[] = [];

    let first = true;
    let arrayType: "B" | "I" | "L" | null = null;

    this.eat(TokenKind.DELIMITER, "[");

    if (
      this.current.kind === TokenKind.STRING &&
      (this.current.value === "B" || this.current.value === "I" || this.current.value === "L")
    ) {
      arrayType = this.eat(TokenKind.STRING).value as unknown as "B" | "I" | "L";
      this.eat(TokenKind.DELIMITER, ";");
    }

    while (!this.matches(TokenKind.DELIMITER, "]")) {
      if (!first) this.eat(TokenKind.DELIMITER, ",");
      first = false;

      if (arrayType === "B") {
        items.push(Number(this.eatNumberSuffixes("int", "b", "B")));
      } else if (arrayType === "I") {
        items.push(Number(this.eatNumberSuffixes("int", "b", "B", "s", "S", "i", "I")));
      } else if (arrayType === "L") {
        items.push(BigInt(this.eatNumberSuffixes("int", "b", "B", "s", "S", "i", "I", "l", "L")));
      } else {
        items.push(this.parseItem());
      }
    }
    this.eat(TokenKind.DELIMITER, "]");

    if (arrayType === "B") return new tags.ByteArrayTag(items as number[]);
    if (arrayType === "I") return new tags.IntArrayTag(items as number[]);
    if (arrayType === "L") return new tags.LongArrayTag(items as bigint[]);

    return new tags.ListTag(items as tags.Tag[]);
  }

  private eatNumberSuffixes(kind: "int" | "float", ...suffixes: string[]): string {
    if (this.matches(TokenKind.BOOLEAN)) {
      if (!suffixes.includes("b") && !suffixes.includes("B")) throw new Error("unexpected boolean");
      if (kind === "float") throw new Error("true|false cannot be used as floating point values");

      return this.eat(TokenKind.BOOLEAN).value === "true" ? "1" : "0";
    }

    const number = this.eat(TokenKind.NUMBER);
    let suffix: string;

    if (kind === "int" && number.value.includes(".")) throw new Error("expected a whole number");
    if (kind === "float" && !number.value.includes(".")) throw new Error("expected a floating point number");

    if (!this.matches(TokenKind.SUFFIX)) {
      if (number.value.includes(".")) suffix = "f";
      else suffix = "i";
    } else {
      suffix = this.eat(TokenKind.SUFFIX).value;
    }

    if (!suffixes.includes(suffix))
      throw new Error(
        `expected a number with the suffix ${suffixes.map((suff) => `'${suff}'`).join(", ")} but got '${suffix}'`,
      );

    return number.value;
  }

  private parseNumber(): tags.Tag {
    const number = this.eat(TokenKind.NUMBER);
    const value = Number(number.value);

    if (!this.matches(TokenKind.SUFFIX)) {
      if (number.value.includes(".")) return new tags.FloatTag(value);
      return new tags.IntTag(value);
    }

    const suffix = this.eat(TokenKind.SUFFIX);

    switch (suffix.value) {
      case "b":
      case "B":
        return new tags.ByteTag(value);

      case "s":
      case "S":
        return new tags.ShortTag(value);

      case "i":
      case "I":
        return new tags.IntTag(value);

      case "l":
      case "L":
        return new tags.LongTag(BigInt(number.value));

      case "f":
      case "F":
        return new tags.FloatTag(value);

      case "d":
      case "D":
        return new tags.DoubleTag(value);
    }

    throw new Error(`invalid suffix '${suffix.value}'`);
  }

  private parseString(): tags.Tag {
    return new tags.StringTag(this.eat(TokenKind.STRING).value);
  }

  private parseBoolean(): tags.Tag {
    return new tags.ByteTag(this.eat(TokenKind.BOOLEAN).value === "true" ? 1 : 0);
  }

  private parseItem(): tags.Tag {
    if (this.matches(TokenKind.NUMBER)) return this.parseNumber();
    if (this.matches(TokenKind.STRING)) return this.parseString();
    if (this.matches(TokenKind.BOOLEAN)) return this.parseBoolean();
    if (this.matches(TokenKind.DELIMITER, "[")) return this.parseList();
    if (this.matches(TokenKind.DELIMITER, "{")) return this.parseCompound();

    throw new Error(`expected {, [, a number, an identifier, or a boolean, but got '${this.current.value}'`);
  }

  parse(): tags.Tag {
    return this.parseItem();
  }
}

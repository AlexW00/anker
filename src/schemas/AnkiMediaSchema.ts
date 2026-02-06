/**
 * Precompiled protobuf JSON schema for Anki media entries.
 *
 * This schema is used with protobufjs/light to avoid runtime .proto parsing
 * which requires Node.js modules that don't work on mobile.
 *
 * Original schema:
 *   syntax = "proto3";
 *   message MediaEntries { repeated MediaEntry entries = 1; }
 *   message MediaEntry { string name = 1; uint32 size = 2; bytes sha1 = 3; }
 */
import protobuf from "protobufjs/light";

/**
 * Precompiled JSON descriptor for Anki media entries protobuf.
 */
export const MediaEntriesSchema = {
    nested: {
        MediaEntries: {
            fields: {
                entries: { rule: "repeated", type: "MediaEntry", id: 1 },
            },
        },
        MediaEntry: {
            fields: {
                name: { type: "string", id: 1 },
                size: { type: "uint32", id: 2 },
                sha1: { type: "bytes", id: 3 },
            },
        },
    },
};

/**
 * Get the protobuf Root for Anki media entries.
 * Uses precompiled JSON schema with protobufjs/light.
 */
let cachedRoot: protobuf.Root | null = null;

export function getMediaEntriesRoot(): protobuf.Root {
    if (!cachedRoot) {
        cachedRoot = protobuf.Root.fromJSON(MediaEntriesSchema);
    }
    return cachedRoot;
}

/**
 * Get the MediaEntries type for decoding.
 */
let cachedType: protobuf.Type | null = null;

export function getMediaEntriesType(): protobuf.Type {
    if (!cachedType) {
        cachedType = getMediaEntriesRoot().lookupType("MediaEntries");
    }
    return cachedType;
}

import { createReadStream, createWriteStream } from "node:fs";
import {
    addAbortSignal,
    Duplex,
    duplexPair,
    finished,
    isErrored,
    isReadable,
    pipeline,
    Readable,
    Transform,
    Writable,
} from "node:stream";
import { promisify } from "node:util";
import { constants, createGzip } from "node:zlib";
import assert = require("node:assert");
import { Blob } from "node:buffer";
import { Http2ServerResponse } from "node:http2";
import { performance } from "node:perf_hooks";
import { stdout } from "node:process";
import * as consumers from "node:stream/consumers";
import { finished as finishedPromise, pipeline as pipelinePromise } from "node:stream/promises";
import { ReadableStream, ReadableStreamBYOBReader, TransformStream, WritableStream } from "node:stream/web";
import { setInterval as every, setTimeout as wait } from "node:timers/promises";
import { MessageChannel as NodeMC } from "node:worker_threads";

// Simplified constructors
function simplified_stream_ctor_test() {
    new Readable({
        construct(cb) {
            // $ExpectType Readable
            this;
            cb();
        },
        read(size) {
            // $ExpectType Readable
            this;
            // $ExpectType number
            size;
        },
        destroy(error, cb) {
            // $ExpectType Error | null
            error;
            // $ExpectType (error?: Error | null | undefined) => void
            cb;
        },
        signal: new AbortSignal(),
    });

    new Writable({
        construct(cb) {
            // $ExpectType Writable
            this;
            cb();
        },
        write(chunk, enc, cb) {
            // $ExpectType Writable
            this;
            // $ExpectType any
            chunk;
            // $ExpectType BufferEncoding
            enc;
            // $ExpectType (error?: Error | null | undefined) => void
            cb;
        },
        writev(chunks, cb) {
            // $ExpectType Writable
            this;
            // $ExpectType { chunk: any; encoding: BufferEncoding; }[]
            chunks;
            // $ExpectType (error?: Error | null | undefined) => void
            cb;
        },
        destroy(error, cb) {
            // $ExpectType Writable
            this;
            // $ExpectType Error | null
            error;
            // $ExpectType (error?: Error | null | undefined) => void
            cb;
        },
        final(cb) {
            // $ExpectType Writable
            this;
            // $ExpectType (error?: Error | null | undefined) => void
            cb;
        },
        defaultEncoding: "utf8",
        signal: new AbortSignal(),
    });

    new Duplex({
        construct(cb) {
            // $ExpectType Duplex
            this;
            cb();
        },
        read(size) {
            // $ExpectType Duplex
            this;
            // $ExpectType number
            size;
        },
        write(chunk, enc, cb) {
            // $ExpectType Duplex
            this;
            // $ExpectType any
            chunk;
            // $ExpectType BufferEncoding
            enc;
            // $ExpectType (error?: Error | null | undefined) => void
            cb;
        },
        writev(chunks, cb) {
            // $ExpectType Duplex
            this;
            // $ExpectType { chunk: any; encoding: BufferEncoding; }[]
            chunks;
            // $ExpectType (error?: Error | null | undefined) => void
            cb;
        },
        destroy(error, cb) {
            // $ExpectType Duplex
            this;
            // $ExpectType Error | null
            error;
            // $ExpectType (error?: Error | null | undefined) => void
            cb;
        },
        final(cb) {
            // $ExpectType Duplex
            this;
            // $ExpectType (error?: Error | null | undefined) => void
            cb;
        },
        readableObjectMode: true,
        writableObjectMode: true,
        readableHighWaterMark: 2048,
        writableHighWaterMark: 1024,
    });

    new Transform({
        construct(cb) {
            // $ExpectType Transform
            this;
            cb();
        },
        read(size) {
            // $ExpectType Transform
            this;
            // $ExpectType number
            size;
        },
        write(chunk, enc, cb) {
            // $ExpectType Transform
            this;
            // $ExpectType any
            chunk;
            // $ExpectType BufferEncoding
            enc;
            // $ExpectType (error?: Error | null | undefined) => void
            cb;
        },
        writev(chunks, cb) {
            // $ExpectType Transform
            this;
            // $ExpectType { chunk: any; encoding: BufferEncoding; }[]
            chunks;
            // $ExpectType (error?: Error | null | undefined) => void
            cb;
        },
        destroy(error, cb) {
            // $ExpectType Transform
            this;
            // $ExpectType Error | null
            error;
            // $ExpectType (error?: Error | null | undefined) => void
            cb;
        },
        final(cb) {
            // $ExpectType Transform
            this;
            // $ExpectType (error?: Error | null | undefined) => void
            cb;
        },
        transform(chunk, enc, cb) {
            // $ExpectType Transform
            this;
            // $ExpectType any
            chunk;
            // $ExpectType BufferEncoding
            enc;
            // $ExpectType TransformCallback
            cb;
        },
        flush(cb) {
            // $ExpectType TransformCallback
            cb;
        },
        allowHalfOpen: true,
        readableObjectMode: true,
        writableObjectMode: true,
        readableHighWaterMark: 2048,
        writableHighWaterMark: 1024,
    });
}

function streamPipelineFinished() {
    let cancel = finished(process.stdin, (err?: Error | null) => {});
    cancel();

    cancel = finished(process.stdin, { readable: false, signal: new AbortSignal() }, (err?: Error | null) => {});
    cancel();

    pipeline(process.stdin, process.stdout, (err?: Error | null) => {});

    const http2ServerResponse: Http2ServerResponse = {} as any;
    pipeline(process.stdin, http2ServerResponse, (err?: Error | null) => {});
}

async function asyncStreamPipelineFinished() {
    const fin = promisify(finished);
    await fin(process.stdin);
    await fin(process.stdin, { error: false });
    await fin(process.stdin, { readable: false });
    await fin(process.stdin, { writable: false });
    await fin(process.stdin, { signal: new AbortSignal() });
    // @ts-expect-error -- callback version does not allow `options.cleanup`
    await fin(process.stdin, { cleanup: false });

    await finishedPromise(process.stdin);
    await finishedPromise(process.stdin, { error: false });
    await finishedPromise(process.stdin, { readable: false });
    await finishedPromise(process.stdin, { writable: false });
    await finishedPromise(process.stdin, { signal: new AbortSignal() });
    await finishedPromise(process.stdin, { cleanup: false });

    const pipe = promisify(pipeline);
    await pipe(process.stdin, process.stdout);
}

// https://nodejs.org/api/stream.html#stream_stream_pipeline_source_transforms_destination_callback
function streamPipelineAsyncTransform() {
    // Transform through a stream, preserving the type of the source
    pipeline(
        process.stdin,
        async function*(source) {
            // $ExpectType ReadStream & { fd: 0; }
            source;
            source.setEncoding("utf8");
            for await (const chunk of source as AsyncIterable<string>) {
                yield chunk.toUpperCase();
            }
        },
        process.stdout,
        err => console.error(err),
    );

    // Read from an iterable and write to a function accepting an AsyncIterable
    pipeline("tasty", async function*(source) {
        // $ExpectType string
        source;
        for (const chunk of source) {
            yield chunk.toUpperCase();
        }
    }, async function*(source: AsyncIterable<string>) {
        // $ExpectType AsyncIterable<string>
        source;
        for await (const chunk of source) {
            console.log(chunk);
        }
        yield null;
    }, err => console.error(err));

    // Finish with a promise
    pipeline("tasty", async function*(source) {
        for (const chunk of source) {
            yield chunk.toUpperCase();
        }
    }, async (source: AsyncIterable<string>) => {
        return new Date();
    }, (err, val) => {
        // $ExpectType Date
        val;
    });

    // Read from an iterable and go through two transforms
    pipeline(
        function*() {
            for (let i = 0; i < 5; i++) {
                yield i;
            }
        },
        async function*(source) {
            for await (const chunk of source) {
                yield chunk + 3;
            }
        },
        async function*(source) {
            for await (const chunk of source) {
                yield chunk.toFixed(3);
            }
        },
        process.stdout,
        err => console.error(err),
    );

    // Accepts ordinary iterable as source
    pipeline(
        [1, 2, 3].values(),
        async function*(source) {
            for (const chunk of source) {
                yield chunk + 3;
            }
        },
        async function*(source) {
            for await (const chunk of source) {
                yield chunk.toFixed(3);
            }
        },
        async function*(source: AsyncIterable<string>) {
            for await (const chunk of source) {
                console.log(chunk);
            }
            yield null;
        },
        err => console.error(err),
    );

    // Accepts buffer as source
    pipeline(
        Buffer.from("test"),
        stdout,
        err => console.error(err),
    );
}

async function streamPipelineAsyncPromiseTransform() {
    // Transform through a stream, preserving the type of the source
    pipelinePromise(process.stdin, async function*(source) {
        // $ExpectType ReadStream & { fd: 0; }
        source;
        source.setEncoding("utf8");
        for await (const chunk of source as AsyncIterable<string>) {
            yield chunk.toUpperCase();
        }
    }, process.stdout).then(r => {
        // $ExpectType void
        r;
    });

    // Read from an iterable and write to a function accepting an AsyncIterable
    pipelinePromise("tasty", async function*(source) {
        // $ExpectType string
        source;
        for (const chunk of source) {
            yield chunk.toUpperCase();
        }
    }, async function*(source: AsyncIterable<string>) {
        // $ExpectType AsyncIterable<string>
        source;
        for await (const chunk of source) {
            console.log(chunk);
        }
        yield null;
    }).then(r => {
        // $ExpectType void
        r;
    });

    // Finish with a promise
    pipelinePromise("tasty", async function*(source) {
        for (const chunk of source) {
            yield chunk.toUpperCase();
        }
    }, async (source: AsyncIterable<string>) => {
        return new Date();
    }).then(r => {
        // $ExpectType Date
        r;
    });

    // Read from an iterable and go through two transforms
    pipelinePromise(
        function*() {
            for (let i = 0; i < 5; i++) {
                yield i;
            }
        },
        async function*(source) {
            for await (const chunk of source) {
                yield chunk + 3;
            }
        },
        async function*(source) {
            for await (const chunk of source) {
                yield chunk.toFixed(3);
            }
        },
        process.stdout,
    ).then(r => {
        // $ExpectType void
        r;
    });
}

async function streamPipelineAsyncPromiseAbortTransform() {
    const { signal } = new AbortController();

    // Transform through a stream, preserving the type of the source
    pipelinePromise(
        process.stdin,
        async function*(source) {
            // $ExpectType ReadStream & { fd: 0; }
            source;
            source.setEncoding("utf8");
            for await (const chunk of source as AsyncIterable<string>) {
                yield chunk.toUpperCase();
            }
        },
        process.stdout,
        { signal },
    ).then(r => {
        // $ExpectType void
        r;
    });

    // Read from an iterable and write to a function accepting an AsyncIterable
    pipelinePromise("tasty", async function*(source) {
        // $ExpectType string
        source;
        for (const chunk of source) {
            yield chunk.toUpperCase();
        }
    }, async function*(source: AsyncIterable<string>) {
        // $ExpectType AsyncIterable<string>
        source;
        for await (const chunk of source) {
            console.log(chunk);
        }
        yield null;
    }, { signal }).then(r => {
        // $ExpectType void
        r;
    });

    // Finish with a promise
    pipelinePromise("tasty", async function*(source) {
        for (const chunk of source) {
            yield chunk.toUpperCase();
        }
    }, async (source: AsyncIterable<string>) => {
        return new Date();
    }, { signal }).then(r => {
        // $ExpectType Date
        r;
    });

    // Read from an iterable and go through two transforms
    pipelinePromise(
        function*() {
            for (let i = 0; i < 5; i++) {
                yield i;
            }
        },
        async function*(source) {
            for await (const chunk of source) {
                yield chunk + 3;
            }
        },
        async function*(source) {
            for await (const chunk of source) {
                yield chunk.toFixed(3);
            }
        },
        process.stdout,
        { signal },
    ).then(r => {
        // $ExpectType void
        r;
    });
}

async function streamPipelineAsyncPromiseOptions() {
    const { signal } = new AbortController();

    // Empty options
    pipelinePromise(process.stdin, process.stdout, {});

    // options with signal property
    pipelinePromise(process.stdin, process.stdout, { signal });

    // options with end property
    pipelinePromise(process.stdin, process.stdout, { end: false });

    // options with both properties
    pipelinePromise(process.stdin, process.stdout, { signal, end: false });

    // options with undefined properties
    pipelinePromise(process.stdin, process.stdout, { signal: undefined, end: undefined });
}

async function testConsumers() {
    let consumable!: ReadableStream | Readable | AsyncGenerator<any>;

    // $ExpectType ArrayBuffer
    await consumers.arrayBuffer(consumable);
    // $ExpectType Blob
    await consumers.blob(consumable);
    // $ExpectType Buffer || Buffer<ArrayBufferLike>
    await consumers.buffer(consumable);
    // $ExpectType unknown
    await consumers.json(consumable);
    // $ExpectType string
    await consumers.text(consumable);
}

// https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options
function stream_readable_pipe_test() {
    const rs = createReadStream(Buffer.from("file.txt"));
    const r = createReadStream("file.txt");
    const z = createGzip({ finishFlush: constants.Z_FINISH });
    const w = createWriteStream("file.txt.gz");

    assert(typeof z.bytesRead === "number");
    assert(typeof r.bytesRead === "number");
    assert(typeof r.path === "string");
    assert(rs.path instanceof Buffer);

    r.pipe(z).pipe(w);

    z.flush();
    r.close();
    z.close();
    rs.close();

    rs.destroy();
    rs[Symbol.asyncDispose]();
}

function stream_duplex_allowHalfOpen_test() {
    const d = new Duplex();
    assert(typeof d.allowHalfOpen === "boolean");
    d.allowHalfOpen = true;
}

addAbortSignal(new AbortSignal(), new Readable());

{
    const a = Readable.from(["test"], {
        objectMode: true,
    });
}

{
    const a = new Readable();
    a.unshift("something", "utf8");
}

{
    const readable = new Readable();
    Readable.isDisturbed(readable); // $ExpectType boolean
    const readableDidRead: boolean = readable.readableDidRead;
    const readableAborted: boolean = readable.readableAborted;
}

{
    isErrored(new Readable()); // $ExpectType boolean
    isErrored(new Duplex()); // $ExpectType boolean
    isErrored(new Writable()); // $ExpectType boolean
}

{
    isReadable(new Readable()); // $ExpectType boolean
    isReadable(new Duplex()); // $ExpectType boolean
}

{
    const readable = new Readable();

    // $ExpectType ReadableStream<any>
    Readable.toWeb(readable);

    // $ExpectType ReadableStream<any>
    Readable.toWeb(readable, {});

    // $ExpectType ReadableStream<any>
    Readable.toWeb(readable, { strategy: {} });

    // $ExpectType ReadableStream<any>
    Readable.toWeb(readable, {
        strategy: {
            highWaterMark: 3,

            size(chunk) {
                // $ExpectType any
                chunk;

                return -1;
            },
        },
    });
}

{
    const web = new ReadableStream();

    // $ExpectType Readable
    Readable.fromWeb(web);

    // Handles subset of ReadableOptions param
    // $ExpectType Readable
    Readable.fromWeb(web, { objectMode: true });

    // When the param includes unsupported ReadableOptions
    // @ts-expect-error
    Readable.fromWeb(web, { emitClose: true });
}

{
    const writable = new Writable();
    // $ExpectType WritableStream<any>
    Writable.toWeb(writable);
}

{
    const web = new WritableStream();

    // $ExpectType Writable
    Writable.fromWeb(web);

    // Handles subset of WritableStream param
    // $ExpectType Writable
    Writable.fromWeb(web, { objectMode: true });

    // When the param includes unsupported WritableStream
    // @ts-expect-error
    Writable.fromWeb(web, { write: true });
}

{
    const duplex = new Duplex();
    // $ExpectType { readable: ReadableStream<any>; writable: WritableStream<any>; }
    Duplex.toWeb(duplex);
}

{
    const [duplexLeft, duplexRight] = duplexPair();
    // $ExpectType Duplex
    duplexLeft;
    // $ExpectType Duplex
    duplexRight;
}

{
    const readable = new ReadableStream();
    const writable = new WritableStream();

    // $ExpectType Duplex
    Duplex.fromWeb({ readable, writable });

    // Handles subset of DuplexOptions param
    // $ExpectType Duplex
    Duplex.fromWeb({ readable, writable }, { objectMode: true });

    // When the param includes unsupported DuplexOptions
    // @ts-expect-error
    Duplex.fromWeb({ readable, writable }, { emitClose: true });

    // $ExpectType Duplex
    Duplex.from(readable);

    // $ExpectType Duplex
    Duplex.from(writable);
}

function testReadableReduce() {
    const readable = Readable.from([]);
    // $ExpectType Promise<number>
    readable.reduce((prev, data) => prev * data);
    // $ExpectType Promise<number>
    readable.reduce((prev, data) => prev * data, 1);
    // @ts-expect-error when specifying an initial value, its type must be consistent with the reducer's return type
    readable.reduce((prev, data) => prev * data, "1");
    // @ts-expect-error when specifying an initial value, its type must be consistent with the reducer's first argument
    readable.reduce((prev: string, data) => +prev * data, 1);
}

function testReadableFind() {
    const readable = Readable.from([]);
    // $ExpectType Promise<any>
    readable.find(Boolean);
    // $ExpectType Promise<any[] | undefined>
    readable.find(Array.isArray);
}

async function testReadableStream() {
    const SECOND = 1000;

    const stream = new ReadableStream<number>({
        async start(controller) {
            for await (const _ of every(SECOND)) controller.enqueue(performance.now());
        },
    });

    for await (const value of stream.values()) {
        // $ExpectType number
        value;
    }

    const streamFromIterable = ReadableStream.from([1, 2, 3, 4]);
    for await (const value of streamFromIterable) {
        // $ExpectType number
        value;
    }

    const streamFromAsyncIterable = ReadableStream.from({
        async *[Symbol.asyncIterator]() {
            for (let i = 0; i < 10; i++) {
                await wait(100);
                yield i;
            }
        },
    });
    for await (const value of streamFromAsyncIterable) {
        // $ExpectType number
        value;
    }

    // ERROR: 538:31  await-promise  Invalid 'for-await-of' of a non-AsyncIterable value.
    // for await (const value of stream) {
    //     // $ExpectType number
    //     value;
    // }
}

async function testWritableStream() {
    const stream = new WritableStream({
        write(chunk) {
            console.log(chunk);
        },
    });

    await stream.getWriter().write("Hello World");
}

async function testTransformStream() {
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue("a");
        },
    });

    const transform = new TransformStream({
        transform(chunk, controller) {
            controller.enqueue(chunk.toUpperCase());
        },
        cancel(reason) {
            // $ExpectType any
            reason;
        },
    });

    const transformedStream = stream.pipeThrough(transform);

    // ERROR: 570:31  await-promise  Invalid 'for-await-of' of a non-AsyncIterable value.
    // for await (const chunk of transformedStream) console.log(chunk);
}

// https://nodejs.org/dist/latest-v16.x/docs/api/webstreams.html#transferring-with-postmessage_2
async function testTransferringStreamWithPostMessage() {
    const stream = new TransformStream();
    {
        // Global constructor
        const { port1, port2 } = new MessageChannel();
    }
    {
        // Constructor from module
        const { port1, port2 } = new NodeMC();
    }

    // error: TypeError: port1.postMessage is not a function
    // port1.onmessage = ({data}) => {
    //     const { writable, readable } = data;
    // }

    // error TS2532: Cannot use 'stream' as a target of a postMessage call because it is not a Transferable.
    // port2.postMessage(stream, [stream]);
}

{
    // checking the type definitions for the events on the Duplex class and subclasses
    const transform = new Transform();
    transform.on("pipe", (src) => {
        // $ExpectType Readable
        src;
    }).once("unpipe", (src) => {
        // $ExpectType Readable
        src;
    }).addListener("data", (chunk) => {
        // $ExpectType any
        chunk;
    }).prependOnceListener("error", (err) => {
        // $ExpectType Error
        err;
    });
}

{
    let byobReader = new Blob(["1", "2"]).stream().getReader({ mode: "byob" });
    byobReader = new ReadableStreamBYOBReader(new Blob([]).stream());

    // $ExpectType Promise<void>
    byobReader.cancel();
    // $ExpectType Promise<void>
    byobReader.cancel("reason");

    // $ExpectType Promise<void>
    byobReader.closed;

    // $ExpectType Promise<ReadableStreamReadResult<Uint8Array<ArrayBuffer>>>
    byobReader.read(new Uint8Array());
    // $ExpectType Promise<ReadableStreamReadResult<Uint8Array<ArrayBuffer>>>
    byobReader.read(new Uint8Array(), {});
    // $ExpectType Promise<ReadableStreamReadResult<Uint8Array<ArrayBuffer>>>
    byobReader.read(new Uint8Array(), { min: 1 });

    // $ExpectType void
    byobReader.releaseLock();
}

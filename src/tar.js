/* jshint esversion: 6 */

var tar = tar || {};

tar.Archive = class {

    constructor(buffer) {
        this._entries = [];
        let reader = new tar.Reader(buffer, 0, buffer.length);
        while (reader.peek()) {
            this._entries.push(new tar.Entry(reader));
            if (reader.match(512, 0)) {
                break;
            }
        }
    }

    get entries() {
        return this._entries;
    }
};

tar.Entry = class {

    constructor(reader) {
        let position = reader.position;
        let header = reader.bytes(512);
        reader.position = position;
        let sum = 0;
        for (let i = 0; i < header.length; i++) {
            sum += (i >= 148 && i < 156) ? 32 : header[i];
        }
        this._name = reader.string(100);
        reader.string(8); // file mode
        reader.string(8); // owner
        reader.string(8); // group
        let size = parseInt(reader.string(12).trim(), 8); // size
        reader.string(12); // timestamp
        let checksum = parseInt(reader.string(8).trim(), 8); // checksum
        if (isNaN(checksum) || sum != checksum) {
            throw new tar.Error('Invalid tar archive.');
        }
        reader.string(1); // link indicator
        reader.string(100); // name of linked file
        reader.bytes(255);
        this._data = reader.bytes(size);
        reader.bytes(((size % 512) != 0) ? (512 - (size % 512)) : 0);
    }

    get name() {
        return this._name;
    }

    get data() {
        return this._data; 
    }
};

tar.Reader = class {

    constructor(buffer) {
        this._buffer = buffer;
        this._position = 0;
        this._end = buffer.length;
    }

    get position() {
        return this._position;
    }

    set position(value) {
        this._position = value;
    }

    peek() {
        return this._position < this._end;
    }

    match(size, value) {
        if (this._position + size <= this._end) {
            if (this._buffer.subarray(this._position, this._position + size).every((c) => c == value)) {
                this._position += size;
                return true;
            }
        }
        return false;
    }

    bytes(size) {
        if (this._position + size > this._end) {
            throw new tar.Error('Data not available.');
        }
        let data = this._buffer.subarray(this._position, this._position + size);
        this._position += size;
        return data;
    }

    string(size) {
        let buffer = this.bytes(size);
        let position = 0;
        let str = '';
        for (let i = 0; i < size; i++) {
            let c = buffer[position++];
            if (c == 0) {
                break;
            }
            str += String.fromCharCode(c);
        }
        return str;
    }
};

tar.Error = class extends Error {
    constructor(message) {
        super(message);
        this.name = 'tar Error';
    }
};

if (typeof module !== 'undefined' && typeof module.exports === 'object') {
    module.exports.Archive = tar.Archive;
}
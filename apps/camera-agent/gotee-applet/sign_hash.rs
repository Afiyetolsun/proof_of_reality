//! Sign — HMAC-SHA256 a host-supplied payload with a hardware-derived key.
//!
//! The derived key is obtained once via `RPC.Attest(true)` (DCP/CAAM key
//! derivation) and never leaves Secure World. The host sends the payload as
//! lowercase hex; the applet returns a JSON envelope:
//!
//!   {"Method":"Sign","Input":"<hex payload>"}
//!     -> {"Output":"{\"device_id\":\"...\",\"nonce\":\"...\",\"mac\":\"...\"}"}
//!
//! `device_id` = first 8 bytes of SHA256(derived_key), hex (16 chars).
//! `nonce`     = 16 bytes from the hardware RNG, hex (32 chars).
//! `mac`       = HMAC-SHA256(derived_key, payload || nonce), hex (64 chars).
//!
//! Hot-swap:
//!   cp examples/sign_hash/main.rs src/main.rs
//!   make applet
//!   bun run upload target/armv7a-none-eabi/release/trusted_applet
//!
//! Then:
//!   printf '{"Method":"Sign","Input":"deadbeef"}\n' | nc 10.0.0.1 4000

#![no_std]
#![no_main]

use core::sync::atomic::{AtomicBool, Ordering};
use gotee_syscall::{self, log};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

const ATTEST_REQ: &[u8] = br#"{"method":"RPC.Attest","params":[true],"id":1}"#;

const KEY_MAX: usize = 64;
static mut KEY_BUF: [u8; KEY_MAX] = [0u8; KEY_MAX];
static mut KEY_LEN: usize = 0;
static mut DEVICE_ID: [u8; 16] = [0u8; 16]; // hex of first 8 bytes of SHA256(key)
static KEY_READY: AtomicBool = AtomicBool::new(false);

fn ensure_key() -> bool {
    if KEY_READY.load(Ordering::Acquire) {
        return true;
    }
    gotee_syscall::rpc_request(ATTEST_REQ);
    let mut resp = [0u8; 512];
    let n = gotee_syscall::rpc_response(&mut resp);
    if n == 0 {
        return false;
    }
    let key = match parse_derived_key(&resp[..n]) {
        Some(k) => k,
        None => return false,
    };
    if key.is_empty() || key.len() > KEY_MAX {
        return false;
    }
    let mut h = Sha256::new();
    h.update(&key[..]);
    let digest = h.finalize();
    unsafe {
        KEY_BUF[..key.len()].copy_from_slice(&key);
        KEY_LEN = key.len();
        hex_into(&digest[..8], &mut DEVICE_ID);
    }
    KEY_READY.store(true, Ordering::Release);
    true
}

fn handle(method: &str, input: &[u8], out: &mut [u8]) -> usize {
    match method {
        "Sign" => sign(input, out),
        _ => 0,
    }
}

fn sign(input_hex: &[u8], out: &mut [u8]) -> usize {
    if !ensure_key() {
        return write_err(out, b"attest_failed");
    }
    let mut payload = [0u8; 256];
    let plen = match hex_decode(input_hex, &mut payload) {
        Some(n) => n,
        None => return write_err(out, b"bad_hex_input"),
    };

    let mut nonce = [0u8; 16];
    gotee_syscall::getrandom(&mut nonce);

    let mac_bytes: [u8; 32] = {
        let mut mac = HmacSha256::new_from_slice(unsafe { &KEY_BUF[..KEY_LEN] })
            .expect("HMAC accepts any key length");
        mac.update(&payload[..plen]);
        mac.update(&nonce);
        mac.finalize().into_bytes().into()
    };

    let mut nonce_hex = [0u8; 32];
    hex_into(&nonce, &mut nonce_hex);
    let mut mac_hex = [0u8; 64];
    hex_into(&mac_bytes, &mut mac_hex);

    write_envelope(out, unsafe { &DEVICE_ID }, &nonce_hex, &mac_hex)
}

fn write_envelope(out: &mut [u8], dev: &[u8], nonce: &[u8], mac: &[u8]) -> usize {
    let mut w = Writer::new(out);
    w.put(b"{\"device_id\":\"");
    w.put(dev);
    w.put(b"\",\"nonce\":\"");
    w.put(nonce);
    w.put(b"\",\"mac\":\"");
    w.put(mac);
    w.put(b"\"}");
    w.len
}

fn write_err(out: &mut [u8], code: &[u8]) -> usize {
    let mut w = Writer::new(out);
    w.put(b"{\"error\":\"");
    w.put(code);
    w.put(b"\"}");
    w.len
}

struct Writer<'a> {
    buf: &'a mut [u8],
    len: usize,
}

impl<'a> Writer<'a> {
    fn new(buf: &'a mut [u8]) -> Self {
        Self { buf, len: 0 }
    }
    fn put(&mut self, src: &[u8]) {
        let cap = self.buf.len().saturating_sub(self.len);
        let n = src.len().min(cap);
        self.buf[self.len..self.len + n].copy_from_slice(&src[..n]);
        self.len += n;
    }
}

fn hex_into(bytes: &[u8], out: &mut [u8]) {
    debug_assert!(out.len() >= bytes.len() * 2);
    for (i, b) in bytes.iter().enumerate() {
        out[i * 2] = nibble_hex(b >> 4);
        out[i * 2 + 1] = nibble_hex(b & 0x0f);
    }
}

fn nibble_hex(n: u8) -> u8 {
    match n {
        0..=9 => b'0' + n,
        _ => b'a' + (n - 10),
    }
}

fn hex_decode(input: &[u8], out: &mut [u8]) -> Option<usize> {
    if input.len() % 2 != 0 {
        return None;
    }
    let n = input.len() / 2;
    if n > out.len() {
        return None;
    }
    for i in 0..n {
        let hi = nibble_val(input[i * 2])?;
        let lo = nibble_val(input[i * 2 + 1])?;
        out[i] = (hi << 4) | lo;
    }
    Some(n)
}

fn nibble_val(c: u8) -> Option<u8> {
    match c {
        b'0'..=b'9' => Some(c - b'0'),
        b'a'..=b'f' => Some(c - b'a' + 10),
        b'A'..=b'F' => Some(c - b'A' + 10),
        _ => None,
    }
}

/// Extract DerivedKey (base64) from the JSON-RPC reply, decode to bytes.
/// Reply shape: {"id":1,"result":{"DerivedKey":"<base64>","Error":""},"error":null}
fn parse_derived_key(resp: &[u8]) -> Option<heapless_arr::ByteArr> {
    let needle = b"\"DerivedKey\":\"";
    let i = find(resp, needle)?;
    let start = i + needle.len();
    let rest = &resp[start..];
    let end = rest.iter().position(|&c| c == b'"')?;
    let b64 = &rest[..end];
    base64_decode(b64)
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || haystack.len() < needle.len() {
        return None;
    }
    for i in 0..=haystack.len() - needle.len() {
        if &haystack[i..i + needle.len()] == needle {
            return Some(i);
        }
    }
    None
}

mod heapless_arr {
    pub struct ByteArr {
        data: [u8; 64],
        len: usize,
    }
    impl ByteArr {
        pub fn new() -> Self {
            Self { data: [0; 64], len: 0 }
        }
        pub fn push(&mut self, b: u8) -> bool {
            if self.len >= self.data.len() {
                return false;
            }
            self.data[self.len] = b;
            self.len += 1;
            true
        }
        pub fn len(&self) -> usize {
            self.len
        }
        pub fn is_empty(&self) -> bool {
            self.len == 0
        }
    }
    impl core::ops::Deref for ByteArr {
        type Target = [u8];
        fn deref(&self) -> &[u8] {
            &self.data[..self.len]
        }
    }
}

fn base64_decode(input: &[u8]) -> Option<heapless_arr::ByteArr> {
    let mut out = heapless_arr::ByteArr::new();
    let mut buf = 0u32;
    let mut bits = 0u32;
    for &c in input {
        if c == b'=' {
            break;
        }
        let v = match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            b'\r' | b'\n' | b' ' | b'\t' => continue,
            _ => return None,
        };
        buf = (buf << 6) | v as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            if !out.push(((buf >> bits) & 0xff) as u8) {
                return None;
            }
        }
    }
    Some(out)
}

#[no_mangle]
pub extern "C" fn _start() -> ! {
    log!("Sign applet ready");
    gotee_syscall::serve(handle)
}

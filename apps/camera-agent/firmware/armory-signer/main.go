// Bare-metal TamaGo signer firmware for USB Armory Mk II.
//
// On first boot:
//   1. Initialize DCP (data co-processor) + read OTPMK
//   2. If no key blob exists in encrypted partition, generate ECDSA secp256k1
//      keypair using HW RNG, encrypt private key with OTPMK, persist
//   3. Decrypt private key into RAM
//
// Then:
//   4. Bring up USB CDC Ethernet (10.0.0.1/24, host gets 10.0.0.2)
//   5. Start tiny HTTP server on :80 with three endpoints:
//        GET  /pubkey  -> { "address": "0x…" }
//        POST /sign    -> { "hash": "0x…" } -> { "sig": "0x…", "address": "0x…" }
//        GET  /attest  -> { "vendor": "usb-armory-mk2", "fwVersion": "…" }
//
// The private key is derived inside the chip's hardware crypto engine and never
// touches anywhere it could be exfiltrated. Stealing the flash gets you ciphertext.
//
// Build: see Makefile. Flash with armory-boot-usb.

//go:build tamago && arm

package main

import (
	"fmt"
)

func main() {
	// TODO(hackathon): wire actual TamaGo bringup.
	//  - usbarmory.Init()
	//  - dcp.Init() ; load encrypted key blob from MMC; decrypt
	//  - usb.NewDevice(...) with CDC Ethernet config
	//  - net stack: gvisor-tcpip or netstack
	//  - http.ListenAndServe(":80", router)
	fmt.Println("proof-of-reality armory-signer placeholder")
}

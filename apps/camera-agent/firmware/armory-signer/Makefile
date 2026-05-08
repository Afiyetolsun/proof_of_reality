# Build the TamaGo signer firmware for USB Armory Mk II.
#
# Prereqs:
#   - tamago Go toolchain installed (https://github.com/usbarmory/tamago-go)
#   - export TAMAGO=$(which tamago)
#   - export TARGET=usbarmory
#
# Output: armory-signer.imx — flash with armory-boot-usb.

TAMAGO ?= tamago
TARGET ?= usbarmory

.PHONY: build clean flash

build:
	GO_EXTLINK_ENABLED=0 CGO_ENABLED=0 GOOS=tamago GOARCH=arm \
	GOARM=7 $(TAMAGO) build -ldflags "-s -w" -o armory-signer.elf .
	# armory-boot-usb expects an .imx image — wrap with imx_usb tooling
	# TODO: imx-image script

flash: build
	# Requires the Armory in u-boot mode and armory-boot-usb installed
	sudo armory-boot-usb -i armory-signer.imx

clean:
	rm -f armory-signer.elf armory-signer.imx

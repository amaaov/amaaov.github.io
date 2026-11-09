CC ?= cc
CFLAGS ?= -std=c11 -Wall -Wextra -Wpedantic -O2 -DHT_DSP_HOST=1
ROOT = ../../..
INCLUDES = -I. -I$(ROOT)/firmware/include
DSP = ht_voice.c ht_engines.c ht_waveguide.c ht_tape.c ht_analog_bus.c ht_sidechain.c ht_court_chain.c ht_eq_bus.c ht_grain_delay.c ht_reverb.c
CONTRACT = \
	$(ROOT)/firmware/src/ht_controls.c \
	$(ROOT)/firmware/src/ht_fx.c \
	$(ROOT)/firmware/src/ht_gen.c \
	$(ROOT)/firmware/src/ht_mix.c \
	$(ROOT)/firmware/src/ht_court.c \
	$(ROOT)/firmware/src/ht_keys.c \
	$(ROOT)/firmware/src/ht_siteswap.c \
	$(ROOT)/firmware/src/ht_hand_style.c \
	$(ROOT)/firmware/src/ht_mod_matrix.c \
	$(ROOT)/firmware/src/ht_tuning.c \
	$(ROOT)/firmware/src/ht_action_loop.c
BIN = build/ht_dsp_smoke

.PHONY: all test clean

all: $(BIN)

$(BIN): ht_dsp_smoke.c $(DSP) $(CONTRACT)
	mkdir -p build
	$(CC) $(CFLAGS) $(INCLUDES) -o $(BIN) ht_dsp_smoke.c $(DSP) $(CONTRACT) -lm

test: $(BIN)
	./$(BIN)

clean:
	rm -rf build

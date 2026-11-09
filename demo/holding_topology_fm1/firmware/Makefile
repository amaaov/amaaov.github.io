CC ?= cc
CFLAGS ?= -std=c11 -Wall -Wextra -Wpedantic -O2
INCLUDES = -Iinclude
SRC = src/ht_controls.c src/ht_gen.c src/ht_mix.c src/ht_court.c src/ht_fx.c src/ht_keys.c \
	src/ht_siteswap.c src/ht_hand_style.c src/ht_mod_matrix.c src/ht_tuning.c src/ht_action_loop.c \
	src/ht_engine_assign.c
SMOKE = test/ht_smoke.c
SITESWAP_TEST = test/ht_siteswap_test.c
MOD_TEST = test/ht_mod_matrix_test.c
TUNING_TEST = test/ht_tuning_test.c
ACTION_TEST = test/ht_action_loop_test.c
HAND_TEST = test/ht_hand_style_test.c
FX_TEST = test/ht_fx_test.c
GEN_TEST = test/ht_gen_test.c
BIN = build/ht_smoke
BIN_SS = build/ht_siteswap_test
BIN_MOD = build/ht_mod_matrix_test
BIN_TUNING = build/ht_tuning_test
BIN_ACTION = build/ht_action_loop_test
BIN_HAND = build/ht_hand_style_test
BIN_FX = build/ht_fx_test
BIN_GEN = build/ht_gen_test

.PHONY: all test clean

all: $(BIN) $(BIN_SS) $(BIN_MOD) $(BIN_TUNING) $(BIN_ACTION) $(BIN_HAND) $(BIN_FX) $(BIN_GEN)

$(BIN): $(SRC) $(SMOKE) include/*.h
	mkdir -p build
	$(CC) $(CFLAGS) $(INCLUDES) -o $(BIN) $(SRC) $(SMOKE) -lm

$(BIN_SS): $(SRC) $(SITESWAP_TEST) include/*.h
	mkdir -p build
	$(CC) $(CFLAGS) $(INCLUDES) -o $(BIN_SS) $(SRC) $(SITESWAP_TEST) -lm

$(BIN_MOD): $(SRC) $(MOD_TEST) include/*.h
	mkdir -p build
	$(CC) $(CFLAGS) $(INCLUDES) -o $(BIN_MOD) $(SRC) $(MOD_TEST) -lm

$(BIN_TUNING): $(SRC) $(TUNING_TEST) include/*.h
	mkdir -p build
	$(CC) $(CFLAGS) $(INCLUDES) -o $(BIN_TUNING) $(SRC) $(TUNING_TEST) -lm

$(BIN_ACTION): $(SRC) $(ACTION_TEST) include/*.h
	mkdir -p build
	$(CC) $(CFLAGS) $(INCLUDES) -o $(BIN_ACTION) $(SRC) $(ACTION_TEST) -lm

$(BIN_HAND): $(SRC) $(HAND_TEST) include/*.h
	mkdir -p build
	$(CC) $(CFLAGS) $(INCLUDES) -o $(BIN_HAND) $(SRC) $(HAND_TEST) -lm

$(BIN_FX): $(SRC) $(FX_TEST) include/*.h
	mkdir -p build
	$(CC) $(CFLAGS) $(INCLUDES) -o $(BIN_FX) $(SRC) $(FX_TEST) -lm

$(BIN_GEN): $(SRC) $(GEN_TEST) include/*.h
	mkdir -p build
	$(CC) $(CFLAGS) $(INCLUDES) -o $(BIN_GEN) $(SRC) $(GEN_TEST) -lm

test: $(BIN) $(BIN_SS) $(BIN_MOD) $(BIN_TUNING) $(BIN_ACTION) $(BIN_HAND) $(BIN_FX) $(BIN_GEN)
	./$(BIN)
	./$(BIN_SS)
	./$(BIN_MOD)
	./$(BIN_TUNING)
	./$(BIN_ACTION)
	./$(BIN_HAND)
	./$(BIN_FX)
	./$(BIN_GEN)

clean:
	rm -rf build

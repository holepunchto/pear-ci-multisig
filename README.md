# pear-ci-multisig

> Specialized subset of `pear multisig` CLI for CI pipelines

## Commands

### `link`

Print the deterministic multisig pear link.

Reads config from `pear.json` by default, or from `--config`. You can also provide the multisig fields directly with flags.

```sh
npx pear-ci-multisig link
```

```sh
npx pear-ci-multisig link --config path/to/pear.json
```

```sh
npx pear-ci-multisig link --quorum 2 --namespace my-org/my-app --pubkey <publicKey1> --pubkey <publicKey2>
```

Options:

- `--config <path>` — path to `pear.json`
- `--quorum <n>` — number of required signers
- `--namespace <ns>` — multisig namespace
- `--pubkey <key>` — signer public key, repeatable

Notes:

- `--config` cannot be combined with `--quorum`, `--namespace`, or `--pubkey`
- when no flags are provided, `link` reads `pear.json` directly and expects a top-level `multisig` field

### `pear.json`

Default configuration file used by all commands when `--config` not specified.

Location:

- defaults to `./pear.json`

Required structure:

```json
{
  "multisig": {
    "namespace": "my-org/my-app",
    "quorum": <int>,
    "publicKeys": [
      "<publicKey1>",
      "<publicKeyN...>"
    ]
  }
}
```

Fields:

- `multisig` — required object
- `multisig.namespace` — required string identifying the multisig namespace
- `multisig.quorum` — required integer specifying the number of required signatures
- `multisig.publicKeys` — required array of signer public keys
  - each entry must be a hypercore-id encoded public key
  - array must contain at least one key

Behavior:

- `link` reads `pear.json` directly when no flags are provided
- `request`, `verify`, and `commit` load multisig configuration from this file unless flags are used
- `--config <path>` overrides the default location
- `--quorum`, `--namespace`, and `--pubkey` flags may be used instead of a file
- `--config` cannot be combined with those flags

Validation errors occur if:

- `multisig` is missing
- `namespace` is missing
- `quorum` is missing
- `publicKeys` is missing or empty

---

### `request`

Create a signing request from a versioned source link.

```sh
npx pear-ci-multisig request --config path/to/pear.json <verlink>
```

```sh
npx pear-ci-multisig request --quorum 2 --namespace my-org/my-app --pubkey <publicKey1> --pubkey <publicKey2> <verlink>
```

Options:

- `--config <path>` — path to `pear.json`
- `--quorum <n>` — number of required signers
- `--namespace <ns>` — multisig namespace
- `--pubkey <key>` — signer public key, repeatable
- `--force` — skip requestability checks
- `--peer-update-timeout <ms>` — timeout for peer updates

Arguments:

- `<verlink>` — versioned source pear link

---

### `verify`

Dry-run commit to validate signatures without writing.

```sh
npx pear-ci-multisig verify --config path/to/pear.json <source-link> <request> [responses...]
```

```sh
npx pear-ci-multisig verify --quorum 2 --namespace my-org/my-app --pubkey <publicKey1> --pubkey <publicKey2> <source-link> <request> [responses...]
```

Options:

- `--config <path>` — path to `pear.json`
- `--quorum <n>` — number of required signers
- `--namespace <ns>` — multisig namespace
- `--pubkey <key>` — signer public key, repeatable
- `--force-dangerous` — skip safety checks
- `--peer-update-timeout <ms>` — timeout for peer updates

Arguments:

- `<source-link>` — source pear link
- `<request>` — z32-encoded signing request
- `[responses...]` — z32-encoded responses from signers

Output includes:

- quorum summary
- resulting multisig `link`
- resulting multisig `verlink`
- seed command hint

---

### `commit`

Commit signed changes to the multisig drive.

```sh
npx pear-ci-multisig commit --config path/to/pear.json <source-link> <request> [responses...]
```

```sh
npx pear-ci-multisig commit --quorum 2 --namespace my-org/my-app --pubkey <publicKey1> --pubkey <publicKey2> <source-link> <request> [responses...]
```

Options:

- `--config <path>` — path to `pear.json`
- `--quorum <n>` — number of required signers
- `--namespace <ns>` — multisig namespace
- `--pubkey <key>` — signer public key, repeatable
- `--force-dangerous` — skip safety checks
- `--peer-update-timeout <ms>` — timeout for peer updates

Arguments:

- `<source-link>` — source pear link
- `<request>` — z32-encoded signing request
- `[responses...]` — z32-encoded responses from signers

Output includes:

- quorum summary
- resulting multisig `link`
- resulting multisig `verlink`
- seed command hint

During execution, progress messages may be written to stderr, including commit verification, commit progress, and seeding guidance for first commit.

# Project databases

This directory holds database files that must be available from the repository in local
development, Codespaces, Docker builds, and coworker clones.

## Chemical Companion Database

`ChemicalCompanionDB.db` is the Chemical Companion reference database. Keep it at this
repo-relative path:

```text
data/ChemicalCompanionDB.db
```

The corresponding path in the Docker image is:

```text
/app/data/ChemicalCompanionDB.db
```

This reference database is separate from the application's writable SQLite database
(`server/local.db` locally or `/data/local.db` in Docker). Do not move it into
`server/` or into the Docker volume.

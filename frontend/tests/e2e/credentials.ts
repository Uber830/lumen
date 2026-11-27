// =============================================================================
// The accounts of the seed.
// -----------------------------------------------------------------------------
// The password of the seeded accounts is a fixture of the development
// database, not a credential of the repository: it comes from the
// environment.
//
//   - the CI reads it from the secret `LUMEN_SEED_PASSWORD` of the
//     repository;
//   - the local environment reads it from the `.env` of the frontend,
//     which the Playwright config loads before the tests start.
//
// The account names can stay in the code: they are written down in the
// README and they only work against the local database.
// =============================================================================

/** The password of the seeded accounts. */
function seedPassword(): string {
  const password = process.env.LUMEN_SEED_PASSWORD;
  if (!password) {
    throw new Error(
      "Falta LUMEN_SEED_PASSWORD: la contraseña de las cuentas semilla no está en el entorno. " +
        "En el CI es el secreto del repositorio; en local, el .env del frontend.",
    );
  }
  return password;
}

/** The team of the platform. */
export const TEAM = {
  email: "super@lumen.co",
  password: seedPassword(),
};

/** The administrator of the school of the demo. */
export const SCHOOL_ADMIN = {
  email: "ana.restrepo@sagcor.edu.co",
  password: seedPassword(),
};

/** The password of the seeded accounts, for the tests that need it alone. */
export const SEED_LOGIN = seedPassword();

use crate::api::auth::{hash_password, verify_password};
use crate::cli::Cli;
use crate::domain::user::{NewUser, UserRole};
use crate::repository::user::UserRepository;

/// Reconciles the administrator account described by the configuration, so a
/// fresh deployment has somebody able to hand out roles without a manual SQL
/// statement.
///
/// Declarative rather than one-shot: the configured password and the admin role
/// are reapplied at every startup, which is also how a locked-out or demoted
/// administrator is recovered — restart the service. The flip side is that a
/// password changed by any other means is reverted on the next boot.
pub async fn ensure_super_admin(users: &UserRepository, cli: &Cli) -> anyhow::Result<()> {
    let password = cli.super_admin_password.expose();

    let Some(existing) = users.find_by_email(&cli.super_admin_email).await? else {
        let created = users
            .create(NewUser {
                email: cli.super_admin_email.clone(),
                display_name: cli.super_admin_user.clone(),
                password_hash: hash_password(password)?,
            })
            .await?;
        users.set_role(created.id, UserRole::Admin).await?;
        tracing::info!(user_id = %created.id, email = %cli.super_admin_email,
            "administrator account created");
        return Ok(());
    };

    // Only rehash when the stored hash no longer matches, so a restart does not
    // churn the row and move `updated_at` for nothing.
    if !verify_password(password, &existing.password_hash) {
        users
            .set_password_hash(existing.id, &hash_password(password)?)
            .await?;
        tracing::info!(user_id = %existing.id, "administrator password reapplied");
    }
    if existing.role != UserRole::Admin {
        users.set_role(existing.id, UserRole::Admin).await?;
        tracing::warn!(user_id = %existing.id, was = ?existing.role,
            "administrator account had lost its role, restored");
    }
    tracing::debug!(user_id = %existing.id, "administrator account reconciled");
    Ok(())
}

#[cfg(test)]
mod tests {
    use clap::Parser;
    use sqlx::PgPool;

    use super::ensure_super_admin;
    use crate::api::auth::verify_password;
    use crate::cli::Cli;
    use crate::domain::user::UserRole;
    use crate::repository::user::UserRepository;

    fn cli() -> Cli {
        Cli::parse_from([
            "gruyereka-api",
            "--database-url",
            "postgres://unused",
            "--jwt-secret",
            "unused",
            "--s3-bucket",
            "unused",
            "--super-admin-password",
            "un-mot-de-passe-long",
        ])
    }

    #[sqlx::test]
    async fn creates_the_administrator_then_leaves_it_alone(pool: PgPool) {
        let users = UserRepository::new(pool);
        let cli = cli();

        ensure_super_admin(&users, &cli).await.unwrap();
        let created = users.find_by_email(&cli.super_admin_email).await.unwrap();
        ensure_super_admin(&users, &cli).await.unwrap();
        let again = users.find_by_email(&cli.super_admin_email).await.unwrap();

        let created = created.expect("the account exists");
        let again = again.expect("the account still exists");
        assert_eq!(created.role, UserRole::Admin);
        assert_eq!(created.display_name, "admin");
        assert!(verify_password(
            "un-mot-de-passe-long",
            &created.password_hash
        ));
        assert_eq!(created.id, again.id);
        assert_eq!(
            created.updated_at, again.updated_at,
            "a restart that changes nothing must not touch the row"
        );
    }

    #[sqlx::test]
    async fn restores_an_administrator_that_lost_its_role(pool: PgPool) {
        let users = UserRepository::new(pool);
        let cli = cli();
        ensure_super_admin(&users, &cli).await.unwrap();
        let account = users
            .find_by_email(&cli.super_admin_email)
            .await
            .unwrap()
            .unwrap();
        users.set_role(account.id, UserRole::User).await.unwrap();

        ensure_super_admin(&users, &cli).await.unwrap();

        let restored = users.find_by_id(account.id).await.unwrap().unwrap();
        assert_eq!(restored.role, UserRole::Admin);
    }

    #[sqlx::test]
    async fn reapplies_the_configured_password(pool: PgPool) {
        let users = UserRepository::new(pool);
        let cli = cli();
        ensure_super_admin(&users, &cli).await.unwrap();
        let account = users
            .find_by_email(&cli.super_admin_email)
            .await
            .unwrap()
            .unwrap();
        users
            .set_password_hash(account.id, "something-else-entirely")
            .await
            .unwrap();

        ensure_super_admin(&users, &cli).await.unwrap();

        let restored = users.find_by_id(account.id).await.unwrap().unwrap();
        assert!(verify_password(
            "un-mot-de-passe-long",
            &restored.password_hash
        ));
    }
}

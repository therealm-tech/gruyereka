fn main() {
    // Recompile (re-expanding sqlx::migrate!) whenever a migration changes.
    println!("cargo::rerun-if-changed=build.rs");
    println!("cargo::rerun-if-changed=migrations");
}

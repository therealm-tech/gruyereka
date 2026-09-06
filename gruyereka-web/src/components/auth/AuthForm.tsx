"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "@/app/actions/auth";
import { IDLE } from "@/app/actions/state";
import { Notice } from "@/components/ui/Notice";

type Mode = "signIn" | "signUp";

function Field({
  name,
  label,
  type,
  autoComplete,
  hint,
  error,
  defaultValue,
  placeholder,
  mono = false,
}: {
  name: string;
  label: string;
  type: string;
  autoComplete: string;
  hint?: string | undefined;
  error?: string | undefined;
  defaultValue?: string | undefined;
  placeholder?: string | undefined;
  mono?: boolean;
}) {
  const id = `field-${name}`;
  const describedBy =
    error !== undefined ? `${id}-error` : hint !== undefined ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="label-mono">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className={`h-12 rounded-card border bg-white px-3.5 text-base outline-none ${
          error === undefined ? "border-rule focus:border-ink" : "border-refusal"
        } ${mono ? "font-mono text-[15px]" : ""}`}
      />
      {error !== undefined ? (
        <p id={`${id}-error`} className="text-xs text-refusal">
          {error}
        </p>
      ) : hint !== undefined ? (
        <p id={`${id}-hint`} className="text-xs text-mute">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("signIn");
  const [signInState, signInAction, signingIn] = useActionState(signIn, IDLE);
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, IDLE);

  const state = mode === "signIn" ? signInState : signUpState;
  const pending = mode === "signIn" ? signingIn : signingUp;
  const fields = state.status === "error" ? state.fields : undefined;

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-5">
      <h1 className="font-serif text-4xl leading-none">
        {mode === "signIn" ? "Content de vous revoir" : "Créer un compte"}
      </h1>

      <div
        className="flex rounded-card bg-paper-3 p-1"
        role="tablist"
        aria-label="Connexion ou inscription"
      >
        {(["signIn", "signUp"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`h-10 grow rounded-[2px] text-[15px] ${
              mode === value ? "border border-rule bg-white font-semibold" : "text-ink-2"
            }`}
          >
            {value === "signIn" ? "Connexion" : "Inscription"}
          </button>
        ))}
      </div>

      {state.status === "error" ? (
        <Notice title="La connexion n’a pas abouti">{state.message}</Notice>
      ) : null}

      <form
        key={mode}
        action={mode === "signIn" ? signInAction : signUpAction}
        className="flex flex-col gap-4"
      >
        {mode === "signUp" ? (
          <Field
            name="displayName"
            label="Nom affiché"
            type="text"
            autoComplete="nickname"
            placeholder="Comment on vous voit sur vos avis"
            error={fields?.displayName}
          />
        ) : null}
        <Field
          name="email"
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          mono
          error={fields?.email}
        />
        <Field
          name="password"
          label="Mot de passe"
          type="password"
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
          hint={mode === "signUp" ? "12 caractères au minimum." : undefined}
          error={fields?.password}
        />
        <button
          type="submit"
          disabled={pending}
          className="mt-1 h-12 rounded-card bg-ink text-base font-semibold text-paper disabled:opacity-60"
        >
          {pending ? "Un instant…" : mode === "signIn" ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>

      <p className="text-center text-[13px] leading-relaxed text-mute text-pretty">
        Vos dégustations vous appartiennent : vous seul les modifiez ou les supprimez.
      </p>
    </div>
  );
}

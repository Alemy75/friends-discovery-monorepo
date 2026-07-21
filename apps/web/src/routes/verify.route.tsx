import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/use-auth';
import { codeSchema, type CodeValues } from '../auth/schemas';
import { authErrorMessage } from '../auth/auth-error';
import { AuthCard } from '../auth/auth-card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface VerifyState {
  email?: string;
  password?: string;
}

export function VerifyScreen() {
  const { verifyEmail, login } = useAuth();
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as VerifyState;
  const [formError, setFormError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CodeValues>({ resolver: zodResolver(codeSchema) });

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  if (!state.email || !state.password) return <Navigate to="/register" replace />;
  const { email, password } = state;

  const onSubmit = handleSubmit(async ({ code }) => {
    setFormError(null);
    try {
      await verifyEmail(email, code);
      await login(email, password);
      navigate('/');
    } catch (err) {
      setFormError(authErrorMessage(err, { 400: 'Неверный или просроченный код' }));
    }
  });

  return (
    <AuthCard title="Подтвердите email" subtitle={`Мы отправили код на ${email}`}>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <label className="flex flex-col gap-1 text-sm font-geist text-mid-gray">
          Код из письма
          <Input inputMode="numeric" autoComplete="one-time-code" {...register('code')} />
          {errors.code ? <span className="text-xs text-ember">Введите 6-значный код</span> : null}
        </label>
        {formError ? (
          <p ref={errorRef} role="alert" tabIndex={-1} className="text-sm text-ember outline-none">
            {formError}
          </p>
        ) : null}
        <Button type="submit" className="mt-1 w-full" disabled={isSubmitting}>Подтвердить</Button>
      </form>
    </AuthCard>
  );
}

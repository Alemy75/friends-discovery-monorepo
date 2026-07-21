import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/use-auth';
import { loginSchema, type LoginValues } from '../auth/schemas';
import { authErrorMessage } from '../auth/auth-error';
import { AuthCard } from '../auth/auth-card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

export function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setFormError(authErrorMessage(err, { 401: 'Неверный email или пароль' }));
    }
  });

  return (
    <AuthCard
      title="С возвращением"
      subtitle="Войдите, чтобы продолжить."
      footer={<>Впервые здесь? <Link to="/register" className="text-ink font-medium underline underline-offset-2">Создать аккаунт</Link></>}
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <label className="flex flex-col gap-1 text-sm font-geist text-mid-gray">
          Email
          <Input type="email" autoComplete="email" {...register('email')} />
          {errors.email ? <span className="text-xs text-ember">Введите корректный email</span> : null}
        </label>
        <label className="flex flex-col gap-1 text-sm font-geist text-mid-gray">
          Пароль
          <Input type="password" autoComplete="current-password" {...register('password')} />
          {errors.password ? <span className="text-xs text-ember">Введите пароль</span> : null}
        </label>
        {formError ? (
          <p ref={errorRef} role="alert" tabIndex={-1} className="text-sm text-ember outline-none">
            {formError}
          </p>
        ) : null}
        <Button type="submit" className="mt-1 w-full" disabled={isSubmitting}>Войти</Button>
      </form>
    </AuthCard>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/use-auth';
import { registerSchema, type RegisterValues } from '../auth/schemas';
import { authErrorMessage } from '../auth/auth-error';
import { AuthCard } from '../auth/auth-card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

export function RegisterScreen() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await registerUser(email, password);
      navigate('/verify', { state: { email, password } });
    } catch (err) {
      setFormError(authErrorMessage(err, { 409: 'Этот email уже зарегистрирован', 400: 'Проверьте email и пароль' }));
    }
  });

  return (
    <AuthCard
      title="Создайте аккаунт"
      subtitle="Пара шагов — и можно искать друзей."
      footer={<>Уже есть аккаунт? <Link to="/login" className="text-ink font-medium underline underline-offset-2">Войти</Link></>}
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <label className="flex flex-col gap-1 text-sm font-geist text-mid-gray">
          Email
          <Input type="email" autoComplete="email" {...register('email')} />
          {errors.email ? <span className="text-xs text-ember">Введите корректный email</span> : null}
        </label>
        <label className="flex flex-col gap-1 text-sm font-geist text-mid-gray">
          Пароль
          <Input type="password" autoComplete="new-password" {...register('password')} />
          {errors.password ? <span className="text-xs text-ember">Минимум 8 символов</span> : null}
        </label>
        {formError ? (
          <p ref={errorRef} role="alert" tabIndex={-1} className="text-sm text-ember outline-none">
            {formError}
          </p>
        ) : null}
        <Button type="submit" className="mt-1 w-full" disabled={isSubmitting}>Продолжить</Button>
      </form>
    </AuthCard>
  );
}

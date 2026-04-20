import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRegister, useLogin } from '@/hooks/useAuth';

export default function RegisterPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const login = useLogin();

  const registerSchema = z.object({
    username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_-]+$/, t('validation.usernamePattern')),
    displayName: z.string().min(1).max(100),
    password: z.string().min(6).max(128),
  });

  type RegisterInput = z.infer<typeof registerSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = (data: RegisterInput) => {
    registerMutation.mutate(data, {
      onSuccess: () => {
        login.mutate(
          { username: data.username, password: data.password },
          {
            onSuccess: () => {
              navigate('/', { replace: true });
            },
          },
        );
      },
    });
  };

  const isPending = registerMutation.isPending || login.isPending;

  return (
    <div className="surface-card rounded-xl shadow-sm border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground text-center mb-6">
        {t('register.title')}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
            {t('register.usernameLabel')}
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            {...register('username')}
            className="w-full border border-input rounded-lg px-3 py-2 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t('register.usernamePlaceholder')}
          />
          {errors.username && (
            <p className="mt-1 text-xs text-destructive">{errors.username.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-foreground mb-1">
            {t('register.displayNameLabel')}
          </label>
          <input
            id="displayName"
            type="text"
            {...register('displayName')}
            className="w-full border border-input rounded-lg px-3 py-2 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t('register.displayNamePlaceholder')}
          />
          {errors.displayName && (
            <p className="mt-1 text-xs text-destructive">{errors.displayName.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
            {t('register.passwordLabel')}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
            className="w-full border border-input rounded-lg px-3 py-2 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t('register.passwordPlaceholder')}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {registerMutation.isError && (
          <p className="text-sm text-destructive text-center">
            {(registerMutation.error as Error)?.message || t('register.error')}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg px-4 py-2 bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {isPending ? (
            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mx-auto" />
          ) : (
            t('register.submit')
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t('register.hasAccount')}{' '}
        <Link to="/login" className="text-primary hover:underline font-medium">
          {t('register.signInLink')}
        </Link>
      </p>
    </div>
  );
}

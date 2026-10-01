import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/auth-context.js';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ui/toast.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card.js';
import { Input } from '../../components/ui/input.js';
import { PasswordInput } from '../../components/ui/password-input.js';
import { Button } from '../../components/ui/button.js';
import { api } from '../../lib/api/client.js';
import { saveTokens } from '../../lib/auth-storage.js';
import { Lock, CheckCircle2 } from 'lucide-react';

export function ChangePasswordPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('auth.passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);
    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      toast.success(t('auth.passwordChangedSuccess'));
      await refreshUser();

      if (user?.role === 'ADMIN') navigate('/admin');
      else if (user?.role === 'PARENT') navigate('/parent');
      else navigate('/student');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-xl border-slate-200/80 dark:border-slate-800">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-semibold">{t('auth.changePassword')}</CardTitle>
        <CardDescription>{t('auth.mustChangePasswordNotice')}</CardDescription>
      </CardHeader>

      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            label={t('auth.currentPassword')}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            disabled={isLoading}
          />

          <PasswordInput
            label={t('auth.newPassword')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            disabled={isLoading}
          />

          <PasswordInput
            label={t('auth.confirmNewPassword')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            disabled={isLoading}
          />

          <Button type="submit" className="w-full mt-2" size="lg" isLoading={isLoading}>
            {t('auth.changePassword')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function SetupPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (newPassword !== confirmPassword) {
      toast.error(t('auth.passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.auth.setupPassword({ token, newPassword });
      const { user, accessToken, refreshToken } = res.data.data;

      saveTokens(accessToken, refreshToken);
      localStorage.setItem('academy_user', JSON.stringify(user));

      setIsSuccess(true);
      toast.success(t('common.success'));

      setTimeout(() => {
        if (user.role === 'ADMIN') navigate('/admin');
        else if (user.role === 'PARENT') navigate('/parent');
        else navigate('/student');
      }, 1500);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || t('auth.invalidToken'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="shadow-xl text-center p-8">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4 animate-bounce" />
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t('common.success')}
        </h3>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl border-slate-200/80 dark:border-slate-800">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-semibold">{t('auth.setupTitle')}</CardTitle>
        <CardDescription>{t('auth.setupSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            label={t('auth.newPassword')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            disabled={isLoading}
          />

          <PasswordInput
            label={t('auth.confirmNewPassword')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            disabled={isLoading}
          />

          <Button type="submit" className="w-full mt-2" size="lg" isLoading={isLoading}>
            {t('auth.setupTitle')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (newPassword !== confirmPassword) {
      toast.error(t('auth.passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);
    try {
      await api.auth.resetPassword({ token, newPassword });
      toast.success(t('auth.passwordChangedSuccess'));
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || t('auth.invalidToken'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-xl border-slate-200/80 dark:border-slate-800">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-semibold">{t('auth.resetTitle')}</CardTitle>
        <CardDescription>{t('auth.resetSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            label={t('auth.newPassword')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            disabled={isLoading}
          />

          <PasswordInput
            label={t('auth.confirmNewPassword')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            disabled={isLoading}
          />

          <Button type="submit" className="w-full mt-2" size="lg" isLoading={isLoading}>
            {t('auth.resetTitle')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

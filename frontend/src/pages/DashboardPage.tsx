import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import { showToast } from '../components/ui/Toast';
import { useRecommendationsQuery } from '../hooks/useAI';
import { useUploadProfileImageMutation } from '../hooks/useListings';
import { Award, User, GraduationCap, Calendar, Hash, Edit3, Save, CheckCircle, RefreshCcw, Sparkles, MapPin, BookOpen, ArrowRight, XCircle, Clock, Camera } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, session, isLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState<string>(user?.profile_image || '');

  const { data: recommendations = [], isLoading: isRecLoading } = useRecommendationsQuery();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadProfileImageMutation = useUploadProfileImageMutation();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadProfileImageMutation.mutateAsync(file);
      setAvatarUrl(result.url);
      showToast('Profile image uploaded. Click Save Changes to save.', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to upload profile image', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  React.useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setAvatarUrl(user.profile_image || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          full_name: fullName,
          profile_image: avatarUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      await refreshProfile();
      showToast('Profile updated successfully', 'success');
      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error updating profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
        <Skeleton variant="text" className="h-10 w-48 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton variant="rectangular" className="col-span-1 h-80" />
          <Skeleton variant="rectangular" className="col-span-2 h-80" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto text-left">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/50 dark:border-darkbg-border/50 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Welcome, <span className="bg-gradient-to-r from-brand-500 to-indigo-500 bg-clip-text text-transparent">{user.full_name || 'Student'}</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Manage your campus credentials and marketplace identity.
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshProfile}
            className="flex items-center gap-1.5"
          >
            <RefreshCcw className="h-4 w-4" />
            <span>Sync</span>
          </Button>
          
          <Button
            variant={isEditing ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1.5"
          >
            <Edit3 className="h-4 w-4" />
            <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Card Column */}
        <div className="md:col-span-1 space-y-6">
          <Card className="text-center flex flex-col items-center">
            {isEditing ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadProfileImageMutation.isPending}
                className="group relative h-24 w-24 rounded-full overflow-hidden ring-4 ring-brand-500/20 bg-slate-100 dark:bg-darkbg-card transition-all focus:outline-none focus:ring-brand-500 flex items-center justify-center cursor-pointer"
                title="Change profile picture"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName || 'Profile'}
                    className="h-full w-full object-cover group-hover:opacity-60 transition-opacity"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                    <User className="h-12 w-12" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity duration-200">
                  <Camera className="h-5 w-5 mb-0.5" />
                  <span className="text-[9px] font-bold tracking-wider uppercase">Change</span>
                </div>
                {uploadProfileImageMutation.isPending && (
                  <div className="absolute inset-0 bg-black/65 flex items-center justify-center">
                    <div className="h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </button>
            ) : (
              <div className="relative h-24 w-24 rounded-full overflow-hidden bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 ring-4 ring-brand-500/20 flex items-center justify-center shrink-0">
                {user.profile_image ? (
                  <img
                    src={user.profile_image}
                    alt={user.full_name || 'Profile'}
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.avatar-fallback');
                      if (fallback) {
                        fallback.classList.remove('hidden');
                        fallback.classList.add('flex');
                      }
                    }}
                  />
                ) : null}
                <div className={`avatar-fallback ${user.profile_image ? 'hidden' : 'flex'} h-full w-full items-center justify-center`}>
                  <User className="h-12 w-12" />
                </div>
              </div>
            )}
            
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-4">
              {user.full_name || 'Student'}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 break-all w-full mt-1">
              {user.email}
            </p>

            <div className="mt-4">
              {user.verification_status === 'APPROVED' ? (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-200/30">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Verified Student</span>
                </div>
              ) : user.verification_status === 'REJECTED' ? (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 px-3 py-1 rounded-full text-xs font-semibold border border-red-200/30">
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Verification Rejected</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-semibold border border-amber-200/30">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Verification Pending</span>
                </div>
              )}
            </div>

            {/* Ratings & Metrics */}
            <div className="w-full grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-darkbg-border/50">
              <div className="space-y-1">
                <span className="text-xs text-slate-400">Student Rating</span>
                <p className="text-lg font-extrabold text-slate-800 dark:text-slate-200">
                  {user.rating.toFixed(1)} / 5.0
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-400">Total Swaps</span>
                <p className="text-lg font-extrabold text-slate-800 dark:text-slate-200">
                  {user.total_transactions}
                </p>
              </div>
            </div>

            {/* View Trust Profile link */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/profile/${user.id}`)}
              className="w-full mt-4 flex items-center justify-center gap-1 text-xs font-bold rounded-xl py-2"
            >
              <span>View My Trust Profile</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Card>
        </div>

        {/* Info & Editing Column */}
        <div className="md:col-span-2 space-y-6">
          {isEditing ? (
            <Card>
              <CardHeader>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Update Public Details</h3>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Full Name
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                        <User className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white dark:bg-darkbg-body dark:border-darkbg-border/80 dark:focus:border-brand-500 rounded-xl outline-none text-sm transition-all"
                        placeholder="Enter full name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Profile Picture
                    </label>
                    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-darkbg-body/40 border border-slate-200 dark:border-darkbg-border/60 rounded-2xl">
                      <div className="relative h-16 w-16 rounded-full overflow-hidden ring-2 ring-brand-500/20 bg-slate-100 dark:bg-darkbg-card flex items-center justify-center shrink-0">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-8 w-8 text-slate-400" />
                        )}
                        {uploadProfileImageMutation.isPending && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <div className="h-4 w-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Upload new profile photo
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Supports JPEG, PNG, or WEBP. Max 5MB.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadProfileImageMutation.isPending}
                        className="text-xs font-bold shrink-0 px-4 py-2"
                      >
                        {uploadProfileImageMutation.isPending ? 'Uploading...' : 'Choose File'}
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isSaving}
                    className="w-full flex items-center justify-center gap-1.5 font-semibold mt-6"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save Changes</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Student Identity Foundation</h3>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Details layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* College */}
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-900/10">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">College</span>
                      <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                        {user.college?.name || 'KPRIET'}
                      </span>
                    </div>
                  </div>

                  {/* Department */}
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-900/10">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Department</span>
                      <span className="text-base font-bold text-slate-800 dark:text-slate-200 leading-normal">
                        {user.department?.name || 'Non-standard Format / Staff'}
                      </span>
                    </div>
                  </div>

                  {/* Admission Year */}
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-900/10">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Admission Year</span>
                      <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                        {user.admission_year || 'Not Available'}
                      </span>
                    </div>
                  </div>

                  {/* Roll Number */}
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-900/10">
                      <Hash className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Roll Number</span>
                      <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                        {user.roll_number || 'Not Available'}
                      </span>
                    </div>
                  </div>

                </div>

                {/* Info Note about data */}
                <div className="mt-8 p-4 rounded-2xl bg-slate-100/50 dark:bg-darkbg-border/30 text-xs text-slate-400 dark:text-slate-500 leading-normal">
                  Your college, department, admission year, and roll number are read-only and were automatically extracted and verified using your official email (e.g. <code className="font-mono bg-slate-200 dark:bg-darkbg-border px-1 py-0.5 rounded text-[11px] text-slate-600 dark:text-slate-400">YYDDRRR@domain</code>) at first login. Should you see any discrepancy, please contact the campus administrator.
                </div>

              </CardContent>
            </Card>
          )}
        </div>

      </div>

      {/* Recommendations section */}
      {!isRecLoading && recommendations.length > 0 && (
        <div className="space-y-6 pt-4 border-t border-slate-200/50 dark:border-darkbg-border/50">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5 font-sans">
                <Sparkles className="h-5 w-5 text-brand-500 animate-pulse" />
                <span>Recommended for You</span>
              </h3>
              <p className="text-slate-400 text-xs mt-1 leading-normal font-sans">
                Personalized items based on your search interests and campus catalog views.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {recommendations.slice(0, 4).map((item) => (
              <Card
                key={item.id}
                hoverEffect
                onClick={() => {
                  navigate(`/listings/${item.id}`);
                }}
                className="flex flex-col p-0 cursor-pointer overflow-hidden border border-slate-200/50 hover:border-slate-300 dark:border-darkbg-border/60 dark:hover:border-darkbg-border/80 group bg-white dark:bg-darkbg-card"
              >
                {/* Image Container */}
                <div className="h-40 w-full overflow-hidden relative bg-slate-100 dark:bg-darkbg-body flex items-center justify-center border-b border-slate-100 dark:border-darkbg-border/40">
                  {item.images && item.images.length > 0 ? (
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-slate-300 dark:text-slate-600 flex flex-col items-center">
                      <BookOpen className="h-8 w-8 stroke-[1.5]" />
                      <span className="text-[9px] uppercase font-bold mt-1 tracking-wider">No Image</span>
                    </div>
                  )}
                  {/* Condition Badge */}
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase bg-white/90 backdrop-blur-sm text-brand-600 dark:bg-darkbg-card/90 dark:text-brand-400 rounded-full border border-slate-200/50 dark:border-darkbg-border/50 shadow-sm">
                    {item.condition}
                  </span>
                </div>

                {/* Details Container */}
                <div className="p-3.5 flex-1 flex flex-col justify-between text-left space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                        {new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: 'INR',
                          maximumFractionDigits: 0,
                        }).format(item.price)}
                      </span>
                    </div>
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-brand-500 transition-colors line-clamp-1 leading-snug">
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 leading-none">
                      <MapPin className="h-2.5 w-2.5 inline text-slate-400" />
                      <span>
                        {item.seller?.college?.name || 'KPRIET'} — {item.seller?.department?.name?.split(' ')[0] || 'CSE'}
                      </span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-darkbg-border/40 flex items-center justify-between text-[10px] font-bold text-brand-500 dark:text-brand-400 select-none">
                    <span>View Details</span>
                    <ArrowRight className="h-3 w-3 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
export default DashboardPage;

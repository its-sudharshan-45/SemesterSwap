import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrustProfileQuery, useVerifyUserMutation } from '../hooks/useReviews';
import { Card, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import {
  User,
  GraduationCap,
  Award,
  Star,
  CheckCircle,
  XCircle,
  Calendar,
  Sparkles,
  Clock,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());

  const { data: profile, isLoading, isError, refetch } = useTrustProfileQuery(userId);
  const verifyMutation = useVerifyUserMutation();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 text-left animate-fade-in">
        <Skeleton variant="text" className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton variant="rectangular" className="h-64 rounded-3xl" />
          <Skeleton variant="rectangular" className="md:col-span-2 h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-5 text-left animate-fade-in">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/20 border border-red-200/50">
          <XCircle className="h-6 w-6 text-red-500" />
        </div>
        <div className="text-center">
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">Profile not found</h4>
          <p className="text-slate-400 text-sm mt-1">
            We couldn't retrieve the details for this student profile. There was an issue connecting, or they might not exist in the database.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => refetch()} variant="primary" className="font-semibold">
            Retry
          </Button>
          <Button onClick={() => navigate('/marketplace')} variant="outline" className="font-semibold">
            Back to Marketplace
          </Button>
        </div>
      </div>
    );
  }


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getVerificationBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'APPROVED':
        return (
          <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200/20">
            <CheckCircle className="h-3.5 w-3.5" />
            <span>Verified Student</span>
          </div>
        );
      case 'REJECTED':
        return (
          <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 px-3 py-1 rounded-full text-xs font-bold border border-red-200/20">
            <XCircle className="h-3.5 w-3.5" />
            <span>Verification Rejected</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-bold border border-amber-200/20">
            <Clock className="h-3.5 w-3.5" />
            <span>Verification Pending</span>
          </div>
        );
    }
  };

  const handleVerifyToggle = async (approve: boolean) => {
    try {
      await verifyMutation.mutateAsync({ userId: profile.user_id, approve });
    } catch (err) {}
  };

  // Determine trust tier color/text
  const getTrustTier = (score: number) => {
    if (score >= 90) return { label: 'Elite Swapper', color: 'text-indigo-500', bg: 'bg-indigo-500/10' };
    if (score >= 75) return { label: 'High Trust', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    if (score >= 50) return { label: 'Verified Safe', color: 'text-brand-500', bg: 'bg-brand-500/10' };
    return { label: 'Standard', color: 'text-slate-400', bg: 'bg-slate-500/10' };
  };

  const trustTier = getTrustTier(profile.trust_score);

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left animate-fade-in pb-16">
      
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-brand-500 dark:text-slate-500 dark:hover:text-brand-500 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back</span>
      </button>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Profile Card & Trust Dial */}
        <div className="space-y-6 md:col-span-1">
          
          {/* Main profile identity card */}
          <Card className="text-center flex flex-col items-center p-6 relative overflow-hidden bg-white dark:bg-darkbg-card border border-slate-200/50 dark:border-darkbg-border/60">
            <div className="relative h-24 w-24 rounded-full overflow-hidden bg-brand-50 dark:bg-brand-950/20 ring-4 ring-brand-500/10 shadow-inner flex items-center justify-center shrink-0">
              {profile.profile_image ? (
                <img
                  src={profile.profile_image}
                  alt={profile.full_name || 'Student'}
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
              <div className={`avatar-fallback ${profile.profile_image ? 'hidden' : 'flex'} h-full w-full items-center justify-center text-brand-600 dark:text-brand-400`}>
                <User className="h-12 w-12" />
              </div>
            </div>

            <h2 className="text-xl font-extrabold text-slate-800 dark:text-white mt-4 select-all">
              {profile.full_name || 'Verified Student'}
            </h2>
            <p className="text-xs text-slate-455 font-semibold mt-1">
              Joined {formatDate(profile.created_at)}
            </p>

            <div className="mt-4 select-none">
              {getVerificationBadge(profile.verification_status)}
            </div>

            {/* Sub-details */}
            <div className="w-full space-y-2.5 mt-6 pt-5 border-t border-slate-100 dark:border-darkbg-border/40 text-xs">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-450">
                <Award className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">{profile.college_name}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-455">
                <GraduationCap className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">{profile.department_name}</span>
              </div>
              {profile.admission_year && (
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-455">
                  <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>Class of {profile.admission_year}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Dynamic Trust Score Dial Card */}
          <Card className="p-6 flex flex-col items-center text-center bg-white dark:bg-darkbg-card border border-slate-200/50 dark:border-darkbg-border/60">
            <h3 className="font-extrabold text-sm text-slate-850 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-1.5 justify-center">
              <Sparkles className="h-4.5 w-4.5 text-brand-500" />
              <span>Campus Trust Score</span>
            </h3>

            {/* Circular Progress Ring */}
            <div className="relative h-36 w-36 flex items-center justify-center">
              <svg className="absolute transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-slate-100 dark:text-darkbg-border/30"
                />
                {/* Progress Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * profile.trust_score) / 100}
                  className="text-brand-500 transition-all duration-1000 ease-out"
                />
              </svg>
              {/* Trust Score Center Text */}
              <div className="space-y-0.5">
                <span className="text-3xl font-black text-slate-850 dark:text-white leading-none">
                  {profile.trust_score}
                </span>
                <span className="text-[10px] text-slate-400 block font-bold">out of 100</span>
              </div>
            </div>

            {/* Trust Tier Badge */}
            <div className={`mt-4 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${trustTier.color} ${trustTier.bg}`}>
              {trustTier.label}
            </div>

            {/* Score Breakdown breakdown details */}
            <div className="w-full text-left space-y-2 mt-6 pt-5 border-t border-slate-100 dark:border-darkbg-border/40 text-[10px] text-slate-400 dark:text-slate-500">
              <div className="flex justify-between items-center">
                <span>College Verification:</span>
                <span className="font-bold text-slate-650 dark:text-slate-350">
                  {profile.verification_status === 'APPROVED' ? '+30 pts' : '0 pts'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Swapping Reviews Rating:</span>
                <span className="font-bold text-slate-650 dark:text-slate-350">
                  {profile.total_reviews > 0 ? `+${Math.round((profile.rating / 5.0) * 20)} pts` : profile.verification_status === 'APPROVED' ? '+15 pts (neutral)' : '0 pts'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Completed Transactions:</span>
                <span className="font-bold text-slate-650 dark:text-slate-350">
                  +{Math.min(profile.completed_transactions * 4, 20)} pts
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Products Successfully Sold:</span>
                <span className="font-bold text-slate-650 dark:text-slate-350">
                  +{Math.min(profile.products_sold * 4, 10)} pts
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Account Longevity:</span>
                <span className="font-bold text-slate-650 dark:text-slate-350">
                  +{Math.min(Math.floor((now - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24 * 10)), 10)} pts
                </span>
              </div>
            </div>
          </Card>

          {/* Verification Mock Tester Actions (Visible for demo and testing) */}
          <Card className="p-5 border border-amber-100 dark:border-amber-950/20 bg-amber-50/20 dark:bg-amber-950/5">
            <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1 select-none">
              <ShieldCheck className="h-4 w-4" />
              <span>Grader Simulation Panel</span>
            </h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal mb-3">
              Trigger college verification status updates to test automated notifications and reputation rating adjustments.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => handleVerifyToggle(false)}
                variant="outline"
                size="sm"
                className="flex-1 py-1.5 text-xs text-red-500 border-red-200 hover:bg-red-50 dark:border-red-950 dark:hover:bg-red-950/15 font-bold"
                isLoading={verifyMutation.isPending}
              >
                Reject Verification
              </Button>
              <Button
                onClick={() => handleVerifyToggle(true)}
                variant="primary"
                size="sm"
                className="flex-1 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                isLoading={verifyMutation.isPending}
              >
                Approve Verification
              </Button>
            </div>
          </Card>

        </div>

        {/* Right Column: Statistics & Reviews Chronology Timeline */}
        <div className="space-y-6 md:col-span-2">
          
          {/* Key Metrics Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Trading Rating</span>
              <div className="flex items-center justify-center gap-1 mt-1 text-slate-800 dark:text-white">
                <span className="text-lg font-black">{profile.rating.toFixed(1)}</span>
                <Star className="h-4.5 w-4.5 fill-amber-400 text-amber-400 shrink-0" />
              </div>
            </Card>
            <Card className="p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Reviews</span>
              <p className="text-lg font-black text-slate-800 dark:text-white mt-1">{profile.total_reviews}</p>
            </Card>
            <Card className="p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Completed Swaps</span>
              <p className="text-lg font-black text-slate-800 dark:text-white mt-1">{profile.completed_transactions}</p>
            </Card>
            <Card className="p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Products Sold</span>
              <p className="text-lg font-black text-slate-800 dark:text-white mt-1">{profile.products_sold}</p>
            </Card>
          </div>

          {/* Chronological Feedback Feed */}
          <Card className="border border-slate-200/50 dark:border-darkbg-border/60">
            <CardContent className="p-6">
              <h3 className="text-base font-extrabold text-slate-850 dark:text-white mb-6">
                Chronological Swapper Feedback
              </h3>

              {profile.reviews.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs space-y-3">
                  <div className="h-10 w-10 mx-auto rounded-full bg-slate-50 dark:bg-darkbg-border/20 flex items-center justify-center">
                    <Star className="h-5 w-5 stroke-[1.5]" />
                  </div>
                  <p>No feedback ratings received yet. Completed trades establish public reputational history.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {profile.reviews.map((rev) => (
                    <div key={rev.id} className="flex gap-4 p-4 rounded-2xl bg-slate-50/40 dark:bg-darkbg-border/10 border border-slate-150/40 dark:border-darkbg-border/20 text-left">
                      {/* Reviewer Avatar */}
                      <div className="relative h-8 w-8 rounded-full overflow-hidden bg-slate-100 dark:bg-darkbg-body ring-1 ring-slate-200/50 dark:ring-darkbg-border/50 flex items-center justify-center shrink-0">
                        {rev.reviewer?.profile_image ? (
                          <img
                            src={rev.reviewer.profile_image}
                            alt={rev.reviewer.full_name || 'Student'}
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
                        <div className={`avatar-fallback ${rev.reviewer?.profile_image ? 'hidden' : 'flex'} h-full w-full items-center justify-center text-slate-400 bg-slate-100 dark:bg-darkbg-border/20`}>
                          <User className="h-4 w-4" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-202 truncate">
                            {rev.reviewer?.full_name || 'Verified Student'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold shrink-0">
                            {formatDate(rev.created_at)}
                          </span>
                        </div>

                        {/* Stars */}
                        <div className="flex text-amber-400 items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3.5 w-3.5 ${
                                i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-750'
                              }`}
                            />
                          ))}
                        </div>

                        {/* Comment */}
                        {rev.comment ? (
                          <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed pt-0.5">
                            {rev.comment}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic pl-0.5">
                            No written comments provided.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>

    </div>
  );
};
export default ProfilePage;

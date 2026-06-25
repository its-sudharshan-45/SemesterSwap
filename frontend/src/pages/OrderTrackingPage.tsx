import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  useOrderDetailsQuery,
  useAcceptOrderMutation,
  useRejectOrderMutation,
  useCompleteOrderMutation,
  useRescheduleMeetingMutation,
  useAcceptRescheduleMutation,
  useCancelMeetingMutation,
} from '../hooks/useOrders';
import { useListingConversationCreateMutation } from '../hooks/useChat';
import { Card, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import { showToast } from '../components/ui/Toast';
import {
  ArrowLeft,
  ShoppingBag,
  MessageSquare,
  CheckCircle,
  XCircle,
  User,
  Clock,
  ShieldAlert,
  Coins,
  Check,
  Calendar,
  AlertTriangle,
  Star,
  MapPin,
  Info,
} from 'lucide-react';
import { useTrustProfileQuery, useCreateReviewMutation } from '../hooks/useReviews';

export const OrderTrackingPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Queries & Mutations
  const { data: order, isLoading, isError, refetch } = useOrderDetailsQuery(orderId);
  const acceptOrderMutation = useAcceptOrderMutation();
  const rejectOrderMutation = useRejectOrderMutation();
  const completeOrderMutation = useCompleteOrderMutation();
  const chatMutation = useListingConversationCreateMutation();

  // Counter proposal / reschedule states
  const rescheduleMutation = useRescheduleMeetingMutation();
  const acceptRescheduleMutation = useAcceptRescheduleMutation();
  const cancelMeetingMutation = useCancelMeetingMutation();

  const [isRescheduling, setIsRescheduling] = useState(false);
  const [reschedLocation, setReschedLocation] = useState('');
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('10:00 AM - 12:00 PM');

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('Found another option');
  const [customReason, setCustomReason] = useState('');

  // Reviews integration
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const createReviewMutation = useCreateReviewMutation();

  React.useEffect(() => {
    if (order?.meeting) {
      setReschedLocation(order.meeting.location);
      setReschedDate(order.meeting.date);
      setReschedTime(order.meeting.time);
    }
  }, [order]);

  const isBuyer = user && order?.buyer_id === user.id;
  const product = order?.product;
  const otherParty = order ? (isBuyer ? order.seller : order.buyer) : null;

  // Query other user's trust profile
  const { data: otherTrustProfile } = useTrustProfileQuery(otherParty?.id);
  const hasReviewed = otherTrustProfile?.reviews.some(
    (r) => r.reviewer_id === user?.id && r.order_id === order?.id
  );

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    try {
      await createReviewMutation.mutateAsync({
        orderId: order.id,
        rating,
        comment: comment.trim() || undefined,
      });
      setComment('');
    } catch (err) {}
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    try {
      await rescheduleMutation.mutateAsync({
        orderId: order.id,
        meeting_location: reschedLocation,
        meeting_date: reschedDate,
        meeting_time: reschedTime,
      });
      setIsRescheduling(false);
    } catch (err) {}
  };

  const handleAcceptReschedule = async () => {
    if (!order) return;
    try {
      await acceptRescheduleMutation.mutateAsync(order.id);
    } catch (err) {}
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    const finalReason = cancelReason === 'Other' ? customReason.trim() : cancelReason;
    if (!finalReason) {
      showToast('Please provide a cancellation reason.', 'error');
      return;
    }
    try {
      await cancelMeetingMutation.mutateAsync({
        orderId: order.id,
        reason: finalReason,
      });
      setIsCancelling(false);
    } catch (err) {}
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 text-left animate-fade-in">
        <Skeleton variant="text" className="h-6 w-32 mb-4" />
        <Card className="h-64 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2"><Skeleton variant="rectangular" className="h-40 rounded-3xl" /></div>
          <div><Skeleton variant="rectangular" className="h-40 rounded-3xl" /></div>
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-5 text-left animate-fade-in">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/20 border border-red-200/50">
          <XCircle className="h-6 w-6 text-red-500" />
        </div>
        <div className="text-center">
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">Request not found</h4>
          <p className="text-slate-400 text-sm mt-1">
            We couldn't retrieve the details for this meeting request. It might have been deleted, expired, or there's a network issue.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => refetch()} variant="primary" className="font-semibold">
            Retry
          </Button>
          <Button onClick={() => navigate('/orders')} variant="outline" className="font-semibold">
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Determine Stepper Stage statuses: 'completed' | 'active' | 'upcoming' | 'failed'
  const getStepStatus = (stepIndex: number): 'completed' | 'active' | 'upcoming' | 'failed' => {
    if (order.order_status === 'CANCELLED' || order.order_status === 'EXPIRED') {
      if (stepIndex === 0) return 'completed';
      if (stepIndex === 1) return 'failed';
      return 'upcoming';
    }

    switch (stepIndex) {
      case 0: // Request Sent (PENDING)
        return 'completed';
      
      case 1: // Meeting Confirmed
        if (order.meeting?.status === 'SCHEDULED' || order.meeting?.status === 'COMPLETED') return 'completed';
        if (order.meeting?.status === 'PROPOSED') return 'active';
        return 'upcoming';
      
      case 2: // Verification & Payment
        if (order.meeting?.status === 'COMPLETED') return 'completed';
        if (order.meeting?.status === 'SCHEDULED') return 'active';
        return 'upcoming';
      
      case 3: // Swap Finalized
        if (order.meeting?.status === 'COMPLETED') return 'completed';
        return 'upcoming';
      
      default:
        return 'upcoming';
    }
  };

  const getMeetingCountdown = () => {
    if (!order?.meeting) return null;
    try {
      const datePart = order.meeting.date; // "YYYY-MM-DD"
      const timePart = order.meeting.time.split(' - ')[0]; // "10:00 AM"
      
      const meetingDateTime = new Date(`${datePart} ${timePart}`);
      const now = new Date();
      const diffMs = meetingDateTime.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        if (order.meeting.status === 'SCHEDULED') {
          return <span className="text-emerald-500 font-bold">Happening Today / Passed</span>;
        }
        return null;
      }
      
      const diffMins = Math.floor(diffMs / 60000);
      const hours = Math.floor(diffMins / 60);
      const days = Math.floor(hours / 24);
      
      if (days > 0) {
        return <span className="text-brand-650 font-bold">Starts in {days}d {hours % 24}h</span>;
      }
      if (hours > 0) {
        return <span className="text-brand-650 font-bold">Starts in {hours}h {diffMins % 60}m</span>;
      }
      return <span className="text-brand-650 font-bold animate-pulse">Starts in {diffMins}m</span>;
    } catch (e) {
      return null;
    }
  };

  const handleChat = async () => {
    if (!product) {
      showToast('Listing details not available.', 'error');
      return;
    }
    try {
      const conv = await chatMutation.mutateAsync({
        listingId: product.id,
        sellerId: order.seller_id,
      });
      navigate(`/messages/${conv.id}`);
    } catch (err: any) {
      showToast(err.message || 'Could not open chat conversation.', 'error');
    }
  };

  const handleAccept = async () => {
    if (window.confirm('Accept this meeting request and lock coordinates?')) {
      try {
        await acceptOrderMutation.mutateAsync(order.id);
      } catch (err) {}
    }
  };

  const handleDecline = async () => {
    const word = isBuyer ? 'cancel' : 'decline';
    if (window.confirm(`Are you sure you want to ${word} this meeting request? The listing will be returned to availability.`)) {
      try {
        await rejectOrderMutation.mutateAsync(order.id);
      } catch (err) {}
    }
  };

  const handleConfirmCompletion = async () => {
    const confirmationText = isBuyer
      ? "Confirm that you have met the seller, inspected the item, and completed the exchange?"
      : "Confirm that you have met the buyer, handed over the item, and received the payment?";
    if (window.confirm(confirmationText)) {
      try {
        await completeOrderMutation.mutateAsync(order.id);
      } catch (err) {}
    }
  };

  const steps = [
    { title: 'Request Sent', desc: 'Proposed date, time & location' },
    { title: 'Meeting Confirmed', desc: 'Seller approved proposal' },
    { title: 'Verify & Pay', desc: 'Inspect product and pay directly' },
    { title: 'Swap Finalized', desc: 'Double-confirmed & completed' },
  ];

  const hasBuyerConfirmed = !!order.meeting?.confirmation?.buyer_confirmed;
  const hasSellerConfirmed = !!order.meeting?.confirmation?.seller_confirmed;

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left animate-fade-in pb-16">
      
      {/* Back CTA */}
      <button
        onClick={() => navigate('/orders')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-brand-500 dark:text-slate-500 dark:hover:text-brand-500 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Orders Dashboard</span>
      </button>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/50 dark:border-darkbg-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              P2P Meeting Tracker
            </h1>
            {order.order_status === 'CANCELLED' && (
              <span className="px-2 py-0.5 text-[9px] bg-red-50 dark:bg-red-950/20 text-red-600 border border-red-200 dark:border-red-900/40 rounded-full font-bold uppercase tracking-wider">
                Cancelled/Declined
              </span>
            )}
            {order.order_status === 'EXPIRED' && (
              <span className="px-2 py-0.5 text-[9px] bg-amber-50 dark:bg-amber-950/20 text-amber-600 border border-amber-200 dark:border-amber-900/40 rounded-full font-bold uppercase tracking-wider">
                Expired
              </span>
            )}
            {order.order_status === 'COMPLETED' && (
              <span className="px-2 py-0.5 text-[9px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-200 dark:border-emerald-900/40 rounded-full font-bold uppercase tracking-wider">
                Completed
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1 select-all">Request ID: {order.id}</p>
        </div>

        <div className="flex flex-col items-end gap-1">
          {getMeetingCountdown() && (
            <div className="text-xs font-bold flex items-center gap-1 bg-slate-50 dark:bg-darkbg-body border border-slate-200/50 dark:border-darkbg-border/40 px-2 py-1 rounded-lg">
              <Clock className="h-3.5 w-3.5 text-brand-500" />
              {getMeetingCountdown()}
            </div>
          )}
          <div className="flex items-center gap-2">
            {/* Chat with other student */}
            <Button
              onClick={handleChat}
              variant="outline"
              className="flex items-center gap-1.5 font-bold text-xs px-4 py-2"
              isLoading={chatMutation.isPending}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Chat with {isBuyer ? 'Seller' : 'Buyer'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Safety Guidelines Banner */}
      <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-250/20 p-4.5 rounded-2xl flex gap-3 text-left">
        <AlertTriangle className="h-5.5 w-5.5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <h4 className="font-extrabold text-amber-805 dark:text-amber-400">
            ⚠ Peer-to-Peer Safety Guidelines
          </h4>
          <ul className="list-disc pl-4 space-y-1 text-slate-500 dark:text-slate-400 font-medium">
            <li>Meet only in populated, public campus areas (e.g., Library Entrance, CSE Block Entrance).</li>
            <li>Coordinate and schedule meetings during active daytime college hours.</li>
            <li><strong>Inspect the product thoroughly</strong> before transferring cash or initiating any UPI payment.</li>
            <li>Verify the counterparty's identity and product listing details carefully.</li>
            <li>SemesterSwap does not process, hold, or guarantee payments. All transactions are peer-to-peer.</li>
          </ul>
        </div>
      </div>

      {/* Timeline Stepper Container */}
      <Card className="border border-slate-200/60 dark:border-darkbg-border/60 bg-white dark:bg-darkbg-card shadow-sm overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="relative flex flex-col md:flex-row justify-between gap-8 md:gap-4 w-full">
            
            {/* Horizontal Line connector (MD+ screen) */}
            <div className="hidden md:block absolute top-5 left-[8%] right-[8%] h-[2px] bg-slate-100 dark:bg-darkbg-border -z-10" />

            {steps.map((step, idx) => {
              const status = getStepStatus(idx);
              
              const nodeColors = {
                completed: 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20 ring-4 ring-emerald-500/10',
                active: 'bg-brand-500 text-white border-brand-500 animate-pulse shadow-md shadow-brand-500/20 ring-4 ring-brand-500/10',
                upcoming: 'bg-slate-50 dark:bg-darkbg-body text-slate-355 dark:text-slate-600 border-slate-200 dark:border-darkbg-border',
                failed: 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20 ring-4 ring-red-500/10',
              };

              const nodeIcons = {
                completed: <Check className="h-4.5 w-4.5 stroke-[2.5]" />,
                active: <Clock className="h-4.5 w-4.5 stroke-[2]" />,
                upcoming: <span className="text-xs font-bold">{idx + 1}</span>,
                failed: <XCircle className="h-4.5 w-4.5 stroke-[2.5]" />,
              };

              return (
                <div key={idx} className="flex md:flex-col items-start md:items-center text-left md:text-center flex-1 gap-4 md:gap-3.5 relative">
                  
                  {/* Stepper node circle */}
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center border transition-all ${nodeColors[status]}`}>
                    {nodeIcons[status]}
                  </div>

                  {/* Stepper text */}
                  <div className="space-y-0.5">
                    <h4 className={`text-xs font-extrabold tracking-tight ${status === 'upcoming' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-white'}`}>
                      {step.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug max-w-[150px] md:mx-auto">
                      {step.desc}
                    </p>
                  </div>

                </div>
              );
            })}

          </div>
        </CardContent>
      </Card>

      {/* Main Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Side: Order & Role specifics */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Status Banners */}
          {order.order_status === 'CANCELLED' ? (
            <div className="flex gap-3 bg-red-50/50 dark:bg-red-950/10 border border-red-200/20 p-5 rounded-2xl text-left">
              <ShieldAlert className="h-5.5 w-5.5 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <h4 className="text-xs font-bold text-red-700 dark:text-red-400">Request Declined / Cancelled</h4>
                <p className="text-[11px] text-slate-550 leading-normal">
                  This peer-to-peer swap coordination has been cancelled. The associated product listing has been returned to availability.
                </p>
                {order.cancelled_by && (
                  <p className="text-[10px] text-slate-400">
                    Cancelled by: {order.cancelled_by === user?.id ? 'You (Self)' : 'Counterparty Student'}
                  </p>
                )}
                {order.cancelled_at && (
                  <p className="text-[10px] text-slate-400">
                    Cancelled at: {new Date(order.cancelled_at).toLocaleString()}
                  </p>
                )}
                {order.cancel_reason && (
                  <p className="text-[11px] text-slate-650 dark:text-slate-350 italic font-semibold pt-1">
                    Reason: "{order.cancel_reason}"
                  </p>
                )}
              </div>
            </div>
          ) : order.order_status === 'EXPIRED' ? (
            <div className="flex gap-3 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/20 p-5 rounded-2xl text-left">
              <Clock className="h-5.5 w-5.5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400">Request Expired</h4>
                <p className="text-[11px] text-slate-500 leading-normal">
                  This proposed swap request expired automatically because the seller did not confirm the meeting coordinates within 7 days.
                </p>
                {order.expires_at && (
                  <p className="text-[10px] text-slate-450">
                    Expired at: {new Date(order.expires_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ) : order.order_status === 'COMPLETED' ? (
            <div className="space-y-4">
              <div className="flex gap-3 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-250/20 p-5 rounded-2xl">
                <CheckCircle className="h-5.5 w-5.5 text-emerald-500 shrink-0" />
                <div className="space-y-1 text-left">
                  <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Swap Finalized Successfully!</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Awesome! The transaction is closed. Both parties verified the items and coordinates. Thank you for swapping on SemesterSwap!
                  </p>
                </div>
              </div>

              {/* Review submit card */}
              {otherParty && (
                <Card className="border border-slate-200/50 dark:border-darkbg-border/60">
                  <CardContent className="p-5 text-left">
                    {hasReviewed ? (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Your Feedback Submitted</h4>
                        <div className="flex items-start gap-2.5 pt-1">
                          <span className="flex text-amber-400 items-center gap-0.5 shrink-0">
                            {Array.from({ length: 5 }).map((_, i) => {
                              const reviewObj = otherTrustProfile?.reviews.find(
                                (r) => r.reviewer_id === user?.id && r.order_id === order.id
                              );
                              const rVal = reviewObj?.rating || 5;
                              return (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < rVal ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'
                                  }`}
                                />
                              );
                            })}
                          </span>
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 italic">
                            "{otherTrustProfile?.reviews.find(
                              (r) => r.reviewer_id === user?.id && r.order_id === order.id
                            )?.comment || 'No written comments.'}"
                          </span>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleReviewSubmit} className="space-y-4">
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">
                            Rate your swap experience
                          </h4>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            Share feedback about {otherParty.full_name || 'Verified Student'} to support their campus trust score.
                          </p>
                        </div>

                        {/* Interactive stars */}
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, idx) => {
                            const starVal = idx + 1;
                            return (
                              <button
                                type="button"
                                key={idx}
                                onClick={() => setRating(starVal)}
                                onMouseEnter={() => setHoverRating(starVal)}
                                onMouseLeave={() => setHoverRating(null)}
                                className="p-0.5 active:scale-95 transition-transform"
                                title={`${starVal} Stars`}
                              >
                                <Star
                                  className={`h-6 w-6 transition-colors ${
                                    starVal <= (hoverRating ?? rating)
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-slate-250 dark:text-slate-700'
                                  }`}
                                />
                              </button>
                            );
                          })}
                        </div>

                        {/* Comment box */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">
                            Written Feedback (Optional)
                          </label>
                          <textarea
                            rows={2}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Type comments about punctuality, trade process..."
                            className="w-full px-3 py-2 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                          />
                        </div>

                        <Button
                          type="submit"
                          variant="primary"
                          className="w-full font-bold text-xs py-2 rounded-xl"
                          isLoading={createReviewMutation.isPending}
                        >
                          Submit Swap Review
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            /* Active requests state consoles */
            <div className="space-y-6">
              
              {/* Buyer Side Console */}
              {isBuyer && (
                <Card className="border border-slate-200/60 dark:border-darkbg-border/60">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-extrabold text-base text-slate-800 dark:text-white">
                      Swap Coordination Console (Buyer)
                    </h3>

                    {order.order_status === 'CREATED' ? (
                      <div className="space-y-4">
                        <div className="flex gap-3 bg-brand-50/50 dark:bg-brand-950/10 border border-brand-200/25 p-4 rounded-xl text-xs text-slate-500 leading-normal">
                          <Clock className="h-4.5 w-4.5 text-brand-500 shrink-0 mt-0.5 animate-pulse" />
                          <div>
                            <span className="font-bold text-slate-700 dark:text-slate-200">Awaiting Seller Confirmation</span>
                            <p className="mt-0.5">The meeting request is sent. The seller is reviewing your proposed location and date. You can message them inside chat to finalize.</p>
                          </div>
                        </div>

                        {order.expires_at && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 font-bold bg-amber-50/20 dark:bg-amber-950/10 border border-amber-200/20 p-3.5 rounded-xl">
                            ⚠️ This request will expire automatically on {new Date(order.expires_at).toLocaleDateString()} if the seller does not accept.
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            onClick={() => setIsRescheduling(true)}
                            variant="outline"
                            className="flex-1 py-2.5 font-bold rounded-xl text-xs"
                          >
                            Reschedule
                          </Button>
                          <Button
                            onClick={() => setIsCancelling(true)}
                            variant="danger"
                            className="flex-1 py-2.5 font-bold rounded-xl text-xs"
                          >
                            Withdraw Request
                          </Button>
                        </div>
                      </div>
                    ) : order.order_status === 'SELLER_ACCEPTED' ? (
                      <div className="space-y-4">
                        
                        {order.meeting?.status === 'PROPOSED' ? (
                          <div className="flex gap-3 bg-amber-50/50 dark:bg-amber-955/15 border border-amber-200/25 p-4 rounded-xl text-xs text-slate-505 leading-normal">
                            <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="flex-1 space-y-2">
                              <span className="font-bold text-slate-700 dark:text-slate-205">Seller Counter-Proposed meeting coordinates:</span>
                              <div className="bg-white/80 dark:bg-darkbg-card p-3 rounded-lg border border-slate-200/50 dark:border-darkbg-border/60">
                                <p><strong>Location:</strong> {order.meeting.location}</p>
                                <p><strong>Date:</strong> {order.meeting.date}</p>
                                <p><strong>Time:</strong> {order.meeting.time}</p>
                              </div>
                              <Button
                                onClick={handleAcceptReschedule}
                                variant="ghost"
                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors"
                                isLoading={acceptRescheduleMutation.isPending}
                              >
                                Accept Reschedule coordinates
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-3 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/25 p-4 rounded-xl text-xs text-slate-500 leading-normal">
                            <Calendar className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-slate-700 dark:text-slate-200">Meeting Confirmed!</span>
                              <p className="mt-0.5">Coordinate the final meetup inside chat. Meet in a public space, inspect the product condition, and complete the pay directly to the seller.</p>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            onClick={() => setIsRescheduling(true)}
                            variant="outline"
                            className="flex-1 py-2.5 font-bold rounded-xl text-xs"
                          >
                            Reschedule
                          </Button>
                          <Button
                            onClick={() => setIsCancelling(true)}
                            variant="danger"
                            className="flex-1 py-2.5 font-bold rounded-xl text-xs"
                          >
                            Cancel Transaction
                          </Button>
                        </div>

                        {/* Confirmation action */}
                        <div className="bg-slate-50 dark:bg-darkbg-body p-4.5 rounded-xl border border-slate-200/60 dark:border-darkbg-border/60 space-y-3.5 mt-4">
                          <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">Verify Swap Receipt</h4>
                          
                          <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-darkbg-border/40 pb-2.5">
                            <span className="text-slate-400">Seller Confirm Payment:</span>
                            <span className={`font-bold flex items-center gap-1 ${hasSellerConfirmed ? 'text-emerald-500' : 'text-slate-405'}`}>
                              {hasSellerConfirmed ? <Check className="h-4 w-4" /> : <Clock className="h-3.5 w-3.5" />}
                              <span>{hasSellerConfirmed ? 'Received' : 'Pending'}</span>
                            </span>
                          </div>

                          {hasBuyerConfirmed ? (
                            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-500 font-bold bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-200/30 py-2 rounded-xl">
                              <CheckCircle className="h-4 w-4" />
                              <span>You confirmed receiving this item</span>
                            </div>
                          ) : (
                            <Button
                              onClick={handleConfirmCompletion}
                              variant="ghost"
                              className="w-full py-3 font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/10 transition-colors text-xs"
                              disabled={completeOrderMutation.isPending || order.meeting?.status === 'PROPOSED'}
                              isLoading={completeOrderMutation.isPending}
                            >
                              Confirm Item Received & Verified
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )}

              {/* Seller Side Console */}
              {!isBuyer && (
                <Card className="border border-slate-200/60 dark:border-darkbg-border/60">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-extrabold text-base text-slate-800 dark:text-white">
                      Swap Coordination Console (Seller)
                    </h3>

                    {order.order_status === 'CREATED' ? (
                      <div className="space-y-4">
                        <div className="flex gap-3 bg-brand-50/50 dark:bg-brand-950/10 border border-brand-200/25 p-4 rounded-xl text-xs text-slate-505 leading-normal">
                          <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-700 dark:text-slate-205">Incoming Meeting Request</span>
                            <p className="mt-0.5">Please review the proposed date, time, and location. If acceptable, confirm the meeting. Otherwise, decline the proposal.</p>
                          </div>
                        </div>

                        {order.meeting?.status === 'PROPOSED' && (
                          <div className="bg-slate-50 dark:bg-darkbg-body p-3.5 rounded-xl border border-slate-100 dark:border-darkbg-border/60 text-xs space-y-1.5">
                            <span className="font-bold text-slate-700 dark:text-slate-200 block">Proposed Meeting Coordinates</span>
                            <p><strong>Location:</strong> {order.meeting.location}</p>
                            <p><strong>Time:</strong> {order.meeting.date} at {order.meeting.time}</p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            onClick={handleDecline}
                            variant="outline"
                            className="flex-1 py-2.5 font-bold rounded-xl text-xs text-red-500 border-red-200"
                            disabled={rejectOrderMutation.isPending || acceptOrderMutation.isPending}
                            isLoading={rejectOrderMutation.isPending}
                          >
                            Decline Request
                          </Button>
                          <Button
                            onClick={() => setIsRescheduling(true)}
                            variant="outline"
                            className="flex-1 py-2.5 font-bold rounded-xl text-xs"
                            disabled={rejectOrderMutation.isPending || acceptOrderMutation.isPending}
                          >
                            Reschedule
                          </Button>
                          <Button
                            onClick={handleAccept}
                            variant="primary"
                            className="flex-1 py-2.5 font-bold rounded-xl text-xs bg-emerald-600 text-white"
                            disabled={rejectOrderMutation.isPending || acceptOrderMutation.isPending}
                            isLoading={acceptOrderMutation.isPending}
                          >
                            Accept Meeting
                          </Button>
                        </div>
                      </div>
                    ) : order.order_status === 'SELLER_ACCEPTED' ? (
                      <div className="space-y-4">
                        
                        {order.meeting?.status === 'PROPOSED' ? (
                          <div className="flex gap-3 bg-amber-50/50 dark:bg-amber-955/15 border border-amber-200/25 p-4 rounded-xl text-xs text-slate-505 leading-normal">
                            <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="flex-1 space-y-2">
                              <span className="font-bold text-slate-700 dark:text-slate-205">Buyer Counter-Proposed meeting coordinates:</span>
                              <div className="bg-white/80 dark:bg-darkbg-card p-3 rounded-lg border border-slate-200/50 dark:border-darkbg-border/60">
                                <p><strong>Location:</strong> {order.meeting.location}</p>
                                <p><strong>Date:</strong> {order.meeting.date}</p>
                                <p><strong>Time:</strong> {order.meeting.time}</p>
                              </div>
                              <Button
                                onClick={handleAcceptReschedule}
                                variant="ghost"
                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors"
                                isLoading={acceptRescheduleMutation.isPending}
                              >
                                Accept Reschedule coordinates
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-3 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/25 p-4 rounded-xl text-xs text-slate-500 leading-normal">
                            <Check className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-slate-700 dark:text-slate-205">Meeting Arrangement Confirmed!</span>
                              <p className="mt-0.5">Coordinate the exchange location inside chat. Bring the item and allow the buyer to inspect it. Collect direct payment on meetup.</p>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            onClick={() => setIsRescheduling(true)}
                            variant="outline"
                            className="flex-1 py-2.5 font-bold rounded-xl text-xs"
                          >
                            Reschedule
                          </Button>
                          <Button
                            onClick={() => setIsCancelling(true)}
                            variant="danger"
                            className="flex-1 py-2.5 font-bold rounded-xl text-xs"
                          >
                            Cancel Transaction
                          </Button>
                        </div>

                        {/* Confirmation action */}
                        <div className="bg-slate-50 dark:bg-darkbg-body p-4.5 rounded-xl border border-slate-200/60 dark:border-darkbg-border/60 space-y-3.5 mt-4">
                          <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-202">Confirm Swap Completion</h4>
                          
                          <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-darkbg-border/40 pb-2.5">
                            <span className="text-slate-400">Buyer Confirm Handover:</span>
                            <span className={`font-bold flex items-center gap-1 ${hasBuyerConfirmed ? 'text-emerald-500' : 'text-slate-405'}`}>
                              {hasBuyerConfirmed ? <Check className="h-4 w-4" /> : <Clock className="h-3.5 w-3.5" />}
                              <span>{hasBuyerConfirmed ? 'Confirmed' : 'Pending'}</span>
                            </span>
                          </div>

                          {hasSellerConfirmed ? (
                            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-500 font-bold bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-200/30 py-2 rounded-xl">
                              <CheckCircle className="h-4 w-4" />
                              <span>You confirmed receiving direct payment</span>
                            </div>
                          ) : (
                            <Button
                              onClick={handleConfirmCompletion}
                              variant="ghost"
                              className="w-full py-3 font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/10 transition-colors text-xs"
                              disabled={completeOrderMutation.isPending || order.meeting?.status === 'PROPOSED'}
                              isLoading={completeOrderMutation.isPending}
                            >
                              Confirm Payment Received
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )}

            </div>
          )}

          {/* Proposed Meeting Details Card */}
          {order.meeting && (
            <Card className="border border-slate-200/60 dark:border-darkbg-border/60">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Calendar className="h-4.5 w-4.5 text-brand-500" />
                  <span>Proposed Swap Details</span>
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-400 block font-semibold uppercase text-[9px] tracking-wider">Campus Meeting Location</span>
                    <span className="font-bold text-slate-850 dark:text-slate-200 flex items-center gap-1.5 pt-0.5">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span>{order.meeting.location}</span>
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 block font-semibold uppercase text-[9px] tracking-wider">Date & Time Proposed</span>
                    <span className="font-bold text-slate-850 dark:text-slate-200 flex items-center gap-1.5 pt-0.5">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>{order.meeting.date} at {order.meeting.time}</span>
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 block font-semibold uppercase text-[9px] tracking-wider">Payment Facilitation Method</span>
                    <span className="font-bold text-slate-850 dark:text-slate-200 flex items-center gap-1.5 pt-0.5">
                      <Coins className="h-4 w-4 text-slate-400" />
                      <span>{order.meeting.payment_method === 'CASH' ? 'Cash Handover' : 'UPI (Pay directly to seller)'}</span>
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 block font-semibold uppercase text-[9px] tracking-wider">Meeting Status</span>
                    <span className={`font-black uppercase block pt-0.5 ${order.meeting.status === 'CANCELLED' ? 'text-red-500' : 'text-slate-850 dark:text-slate-200'}`}>
                      {order.meeting.status}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Swap Safety Instructions */}
          <div className="flex gap-3 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-250/20 p-5 rounded-2xl">
            <Info className="h-5.5 w-5.5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-left text-xs text-slate-500 leading-normal">
              <span className="font-bold text-slate-700 dark:text-slate-200 block mb-1">Meeting Safety Guidelines:</span>
              <ul className="list-disc pl-4 space-y-1">
                <li>Always meet in populated campus areas (like the Library Entrance or CSE Block lobby).</li>
                <li>Complete your transactions during daytime or active college hours.</li>
                <li><strong>Inspect the product thoroughly</strong> before sending any UPI or Cash payment.</li>
                <li>SemesterSwap does not collect money, hold payments, or guarantee refunds. All payments are peer-to-peer.</li>
              </ul>
            </div>
          </div>

        </div>

        {/* Right Side: Product summary card and User info */}
        <div className="space-y-6">
          
          {/* Product card */}
          {product && (
            <Card className="border border-slate-200/60 dark:border-darkbg-border/60 overflow-hidden p-0">
              <div className="aspect-video w-full overflow-hidden bg-slate-100 dark:bg-darkbg-body flex items-center justify-center border-b border-slate-100 dark:border-darkbg-border/40">
                {product.images && product.images.length > 0 ? (
                  <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" />
                ) : (
                  <ShoppingBag className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <div className="p-5 space-y-3.5">
                <div className="text-left space-y-1">
                  <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400 border border-brand-200/20 rounded-full">
                    {product.category}
                  </span>
                  <h4 className="font-extrabold text-sm text-slate-850 dark:text-white pt-1 select-all">
                    {product.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Listed {new Date(product.created_at).toLocaleDateString()}</span>
                  </p>
                </div>
                
                <div className="flex justify-between items-baseline pt-2 border-t border-slate-100 dark:border-darkbg-border/40 font-extrabold text-sm">
                  <span className="text-slate-400">Total Price</span>
                  <span className="text-brand-500 font-black text-base">{formatPrice(order.amount)}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Student Profile Card */}
          {otherParty && (
            <Card className="border border-slate-200/60 dark:border-darkbg-border/60 p-5">
              <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-3.5">
                {isBuyer ? 'Seller Profile' : 'Buyer Profile'}
              </h4>
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 rounded-full overflow-hidden bg-slate-100 dark:bg-darkbg-body text-slate-500 flex items-center justify-center shrink-0">
                  {otherParty.profile_image ? (
                    <img
                       src={otherParty.profile_image}
                       alt={otherParty.full_name || 'Student'}
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
                  <div className={`avatar-fallback ${otherParty.profile_image ? 'hidden' : 'flex'} h-full w-full items-center justify-center`}>
                    <User className="h-5 w-5" />
                  </div>
                </div>
                <div className="text-left space-y-0.5 overflow-hidden">
                  <p className="font-extrabold text-xs text-slate-800 dark:text-slate-202 truncate">
                    {otherParty.full_name || 'Verified Student'}
                  </p>
                  <p className="text-[10px] text-slate-450 select-all font-mono leading-none truncate">
                    {otherParty.email}
                  </p>
                </div>
              </div>
            </Card>
          )}

        </div>

      </div>

      {/* Rescheduling Modal Form Dialog */}
      {isRescheduling && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white dark:bg-darkbg-card rounded-3xl max-w-md w-full border border-slate-200 dark:border-darkbg-border p-6 shadow-2xl space-y-4 animate-fade-in text-left">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-darkbg-border/60 pb-3">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-brand-500" />
                <span>Counter Propose Schedule</span>
              </h3>
              <button
                onClick={() => setIsRescheduling(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-50 dark:hover:bg-darkbg-body transition-colors"
                title="Close"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Date Proposed
                </label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={reschedDate}
                  onChange={(e) => setReschedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-sm text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Preferred Time Slot
                </label>
                <select
                  value={reschedTime}
                  onChange={(e) => setReschedTime(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-sm text-slate-800 dark:text-slate-200"
                >
                  <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM</option>
                  <option value="12:00 PM - 2:00 PM">12:00 PM - 2:00 PM</option>
                  <option value="2:00 PM - 4:00 PM">2:00 PM - 4:00 PM</option>
                  <option value="4:00 PM - 6:00 PM">4:00 PM - 6:00 PM</option>
                  <option value="Other (discuss in chat)">Other (discuss in chat)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Meeting Location
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Library Entrance, CSE Block Lobby..."
                  value={reschedLocation}
                  onChange={(e) => setReschedLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-sm text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => setIsRescheduling(false)}
                  variant="outline"
                  className="flex-1 font-bold py-2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1 font-bold py-2 bg-brand-500 text-white"
                  isLoading={rescheduleMutation.isPending}
                >
                  Send counter proposal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancellation Dialog Form */}
      {isCancelling && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white dark:bg-darkbg-card rounded-3xl max-w-md w-full border border-slate-200 dark:border-darkbg-border p-6 shadow-2xl space-y-4 animate-fade-in text-left">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-darkbg-border/60 pb-3">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-500" />
                <span>Cancel Swap Meeting</span>
              </h3>
              <button
                onClick={() => setIsCancelling(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-50 dark:hover:bg-darkbg-body transition-colors"
                title="Close"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-4 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Cancellation Reason
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-sm text-slate-800 dark:text-slate-200"
                >
                  <option value="Found another option">Found another option</option>
                  <option value="Item not as described">Item not as described</option>
                  <option value="Schedule conflict / can't meet">Schedule conflict / can't meet</option>
                  <option value="Safety concern">Safety concern</option>
                  <option value="Abusive / suspicious behavior">Abusive / suspicious behavior</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {cancelReason === 'Other' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    Please describe
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter reason..."
                    className="w-full px-3 py-2 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
              )}

              <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-200/20 p-3 rounded-xl text-[10px] text-red-600 dark:text-red-400 leading-normal font-semibold">
                ⚠️ Excessive cancellations (more than 5 per week) will result in temporary campus marketplace listing restriction.
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => setIsCancelling(false)}
                  variant="outline"
                  className="flex-1 font-bold py-2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  className="flex-1 font-bold py-2"
                  isLoading={cancelMeetingMutation.isPending}
                >
                  Confirm Cancellation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default OrderTrackingPage;

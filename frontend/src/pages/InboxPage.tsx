import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  useConversationsQuery,
  useMessagesQuery,
  useSendMessageMutation,
  useRealtimeMessages,
  useTypingIndicator
} from '../hooks/useChat';
import { useBlockUserMutation, useReportUserOrListingMutation } from '../hooks/useSafety';
import {
  useBuyerOrdersQuery,
  useSellerOrdersQuery,
  useCreateOrderMutation,
  useAcceptOrderMutation,
  useRejectOrderMutation,
  useCompleteOrderMutation,
  useRescheduleMeetingMutation,
  useAcceptRescheduleMutation,
  useCancelMeetingMutation
} from '../hooks/useOrders';
import { useTrustProfileQuery } from '../hooks/useReviews';
import { useUploadImageMutation } from '../hooks/useListings';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import { showToast } from '../components/ui/Toast';
import {
  Search,
  Send,
  MoreVertical,
  Flag,
  ArrowLeft,
  MessageSquare,
  X,
  Check,
  CheckCheck,
  Info,
  ExternalLink,
  GraduationCap,
  Award,
  Star,
  MapPin,
  Calendar,
  AlertTriangle,
  HeartHandshake,
  CheckCircle2,
  Clock,
  Sparkles,
  Shield,
  AlertCircle,
  Navigation,
  Image as ImageIcon
} from 'lucide-react';

export const InboxPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');
  
  // Active conversations
  const { data: conversations = [], isLoading: isConversationsLoading, isError: isConversationsError } = useConversationsQuery();

  // Find active conversation
  const activeConversation = conversations.find((c) => c.id === conversationId);

  // Filter conversations based on query
  const filteredConversations = conversations.filter((c) => {
    const otherParticipant = c.buyer_id === user?.id ? c.seller : c.buyer;
    const participantName = otherParticipant?.full_name?.toLowerCase() || '';
    const listingTitle = c.product?.title?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return participantName.includes(query) || listingTitle.includes(query);
  });

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)] min-h-[550px] border-2 border-stone-300 dark:border-darkbg-border/80 bg-white dark:bg-darkbg-card/30 rounded-3xl overflow-hidden shadow-lg backdrop-blur-md">
      <div className="h-full flex">
        {/* Left Side Panel: Conversations List */}
        <div className={`w-full md:w-80 border-r-2 border-stone-300 dark:border-darkbg-border/80 flex flex-col shrink-0 h-full ${conversationId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-stone-200 dark:border-darkbg-border/60 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-extrabold text-slate-800 dark:text-white">Messages</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-brand-500/10 text-brand-500 dark:text-brand-400 rounded-full">
                {conversations.length} {conversations.length === 1 ? 'chat' : 'chats'}
              </span>
            </div>
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students or listings..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/60 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border/60 dark:focus:border-brand-500 rounded-2xl outline-none text-xs text-slate-800 dark:text-slate-200 transition-all focus:ring-2 focus:ring-brand-500/10"
              />
            </div>
          </div>

          {/* Conversations Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-stone-200/80 dark:divide-darkbg-border/20">
            {isConversationsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} variant="rectangular" className="h-16 rounded-xl" />
                ))}
              </div>
            ) : isConversationsError ? (
              <div className="p-6 text-center text-xs text-red-500 flex flex-col items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                <span>Failed to load inbox conversations.</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2 mt-10">
                <MessageSquare className="h-8 w-8 stroke-[1.5] text-slate-300 dark:text-slate-700" />
                <span>No active conversations found.</span>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const otherUser = conv.buyer_id === user?.id ? conv.seller : conv.buyer;
                const isSelected = conv.id === conversationId;
                
                // Formatted Time
                let formattedTime = '';
                if (conv.last_message) {
                  const msgDate = new Date(conv.last_message.created_at);
                  const today = new Date();
                  if (msgDate.toDateString() === today.toDateString()) {
                    formattedTime = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  } else {
                    formattedTime = msgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  }
                }

                return (
                  <div
                    key={conv.id}
                    onClick={() => navigate(`/messages/${conv.id}`)}
                    className={`flex items-center gap-3 p-3.5 cursor-pointer border-l-4 transition-all ${
                      isSelected
                        ? 'bg-brand-50/50 dark:bg-brand-950/10 border-brand-500'
                        : 'border-transparent hover:bg-slate-50/50 dark:hover:bg-darkbg-body/20'
                    }`}
                  >
                    {/* User profile image */}
                    <div className="relative">
                      {otherUser?.profile_image ? (
                        <img
                          src={otherUser.profile_image}
                          alt={otherUser.full_name || 'User'}
                          className="h-10 w-10 rounded-full object-cover ring-2 ring-brand-500/5 shrink-0"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-650 dark:text-brand-400 text-sm font-bold ring-2 ring-brand-500/5 shrink-0">
                          {otherUser?.full_name?.charAt(0).toUpperCase() || 'S'}
                        </div>
                      )}
                      {/* Active indicator dot */}
                      <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-darkbg-card" />
                    </div>

                    {/* Meta information */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 truncate">
                          {otherUser?.full_name || 'Verified Student'}
                        </h4>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold whitespace-nowrap">
                          {formattedTime}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-darkbg-border/60 text-slate-500 dark:text-slate-400 truncate max-w-[120px] font-bold">
                          {conv.product?.title || 'General Chat'}
                        </span>
                        {conv.product?.price !== undefined && (
                          <span className="text-[9px] font-extrabold text-slate-900 dark:text-slate-100">
                            ₹{conv.product.price}
                          </span>
                        )}
                      </div>
                      
                      <p className={`text-xs mt-1.5 truncate ${conv.unread_count && conv.unread_count > 0 ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        {conv.last_message?.content || 'No messages yet'}
                      </p>
                    </div>

                    {/* Unread Message Count Badge */}
                    {conv.unread_count && conv.unread_count > 0 ? (
                      <span className="flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-brand-500 text-[9px] font-extrabold text-white shrink-0 shadow-sm">
                        {conv.unread_count}
                      </span>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side Panel: Chat Window & Optional Profile Details */}
        <div className={`flex-1 h-full flex ${conversationId ? 'flex' : 'hidden md:flex'}`}>
          {activeConversation ? (
            <ChatWindowWrapper conversation={activeConversation} key={activeConversation.id} />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 dark:bg-brand-950/20 text-brand-500 border border-brand-200/20 shadow-inner">
                <MessageSquare className="h-8 w-8 stroke-[1.5]" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Select a Conversation</h3>
                <p className="text-slate-400 dark:text-slate-500 text-xs mt-1.5 leading-relaxed">
                  Choose a student contact from your inbox or contact a seller directly on any listing details page to discuss swap options.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* Chat Window Wrapper to handle layout split with side panel */
const ChatWindowWrapper: React.FC<{ conversation: any }> = ({ conversation }) => {
  const { user } = useAuth();
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);

  // Queries to fetch active coordination requests
  const isBuyer = user?.id === conversation.buyer_id;
  const { data: buyerOrders = [], refetch: refetchBuyer } = useBuyerOrdersQuery();
  const { data: sellerOrders = [], refetch: refetchSeller } = useSellerOrdersQuery();

  const orders = isBuyer ? buyerOrders : sellerOrders;
  
  // Find active purchase request/order
  const activeOrder = [...orders]
    .filter((o) => o.product_id === conversation.product_id && (isBuyer ? o.seller_id === conversation.seller_id : o.buyer_id === conversation.buyer_id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const refetchOrders = () => {
    if (isBuyer) refetchBuyer();
    else refetchSeller();
  };

  const otherParticipant = conversation.buyer_id === user?.id ? conversation.seller : conversation.buyer;

  return (
    <div className="flex-1 h-full flex overflow-hidden w-full relative">
      {/* Central Chat Panel */}
      <div className="flex-1 h-full flex flex-col min-w-0 bg-slate-50/20 dark:bg-darkbg-body/5 relative">
        <ChatWindow 
          conversation={conversation} 
          activeOrder={activeOrder} 
          refetchOrders={refetchOrders} 
          isSafetyOpen={isSafetyOpen} 
          setIsSafetyOpen={setIsSafetyOpen} 
        />
      </div>

      {/* Right Slide-Out Profile Detail Panel */}
      {isSafetyOpen && otherParticipant && (
        <div className="w-80 border-l-2 border-stone-300 dark:border-darkbg-border/80 bg-white dark:bg-darkbg-card flex flex-col shrink-0 h-full animate-fade-in">
          <ProfileDetailsDrawer 
            otherUser={otherParticipant} 
            productId={conversation.product_id}
            onClose={() => setIsSafetyOpen(false)} 
          />
        </div>
      )}
    </div>
  );
};

/* Central Active Chat Interface */
interface ChatWindowProps {
  conversation: any;
  activeOrder: any;
  refetchOrders: () => void;
  isSafetyOpen: boolean;
  setIsSafetyOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ 
  conversation, 
  activeOrder, 
  refetchOrders, 
  isSafetyOpen, 
  setIsSafetyOpen 
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // States
  const [messageText, setMessageText] = useState('');
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [isProposeOpen, setIsProposeOpen] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('10:00 AM - 12:00 PM');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI'>('UPI');
  const [coordinationMessage, setCoordinationMessage] = useState('');

  const [msgLimit, setMsgLimit] = useState(50);
  const isTypingStateRef = useRef(false);
  const typingTimeoutRef = useRef<any>(null);

  // Queries & Mutations
  const { data: messages = [], isLoading: isMessagesLoading } = useMessagesQuery(conversation.id, msgLimit, 0);
  const sendMutation = useSendMessageMutation(conversation.id);
  
  // Coordination & upload mutations
  const uploadImageMutation = useUploadImageMutation();
  const createOrderMutation = useCreateOrderMutation();
  const acceptOrderMutation = useAcceptOrderMutation();
  const rejectOrderMutation = useRejectOrderMutation();
  const completeOrderMutation = useCompleteOrderMutation();
  const rescheduleMutation = useRescheduleMeetingMutation();
  const acceptRescheduleMutation = useAcceptRescheduleMutation();
  const cancelMutation = useCancelMeetingMutation();

  // Real-time synchronization
  useRealtimeMessages(conversation.id);
  const { typingUser, sendTypingStatus } = useTypingIndicator(conversation.id);

  // Ref references
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Scroll to bottom on new messages (ignores load-older prepends)
  useEffect(() => {
    if (messages.length === 0) return;
    const latestMessage = messages[messages.length - 1];
    if (latestMessage.id !== lastMessageIdRef.current || typingUser) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      lastMessageIdRef.current = latestMessage.id;
    }
  }, [messages, typingUser]);

  // Auto-resize message input textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [messageText]);

  // Typing status broadcast logic
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    
    if (!isTypingStateRef.current) {
      isTypingStateRef.current = true;
      sendTypingStatus(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      isTypingStateRef.current = false;
      sendTypingStatus(false);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift + Enter: go to next line
      } else {
        // Enter without Shift: send message
        e.preventDefault();
        handleSend();
      }
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageText.trim() || sendMutation.isPending) return;

    try {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      isTypingStateRef.current = false;
      sendTypingStatus(false);

      await sendMutation.mutateAsync(messageText);
      setMessageText('');
    } catch (err: any) {
      showToast(err.message || 'Error sending message', 'error');
    }
  };

  // Quick replies click handler
  const handleQuickReply = async (text: string) => {
    if (sendMutation.isPending) return;
    try {
      await sendMutation.mutateAsync(text);
    } catch (err: any) {
      showToast(err.message || 'Error sending quick reply', 'error');
    }
  };

  // Create proposed meeting request
  const handleProposeMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingDate) {
      showToast('Please choose a meeting date', 'error');
      return;
    }

    try {
      await createOrderMutation.mutateAsync({
        product_id: conversation.product_id,
        payment_method: paymentMethod,
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        meeting_location: meetingLocation,
        message: coordinationMessage.trim() || undefined
      });
      setIsProposeOpen(false);
      setCoordinationMessage('');
      refetchOrders();
    } catch (err) {}
  };

  // Counter-propose reschedule request
  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !meetingDate) return;

    try {
      await rescheduleMutation.mutateAsync({
        orderId: activeOrder.id,
        meeting_location: meetingLocation,
        meeting_date: meetingDate,
        meeting_time: meetingTime
      });
      setIsRescheduleOpen(false);
      refetchOrders();
    } catch (err) {}
  };

  // Handle image upload from file picker
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files[0]) return;
    const file = files[0];

    // Validate type & size
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Supported formats: JPEG, PNG, WEBP.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1025) {
      showToast('File size must be less than 5MB.', 'error');
      return;
    }

    try {
      const result = await uploadImageMutation.mutateAsync({
        listingId: conversation.product_id,
        file
      });
      // Send message with image prefix format
      await sendMutation.mutateAsync(`[image]${result.url}`);
    } catch (err: any) {
      showToast(err.message || 'Image upload failed', 'error');
    } finally {
      // Reset input value to allow re-upload of same file
      e.target.value = '';
    }
  };

  const otherParticipant = conversation.buyer_id === user?.id ? conversation.seller : conversation.buyer;
  const isBuyer = user?.id === conversation.buyer_id;

  // Render context-aware quick reply chips
  const quickReplies = isBuyer
    ? ['Is this still available?', 'Can we meet at the library?', 'Can I inspect it first?', 'Sure, that works!']
    : ['Yes, it is available!', 'I can meet at the CSE block.', 'What time works for you?', 'Sure, that works!'];

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden relative">
      {/* Active Chat Header */}
      <div className="px-4 py-3 border-b-2 border-stone-300 dark:border-darkbg-border/80 flex items-center justify-between bg-white dark:bg-darkbg-card/20 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button on mobile */}
          <button
            onClick={() => navigate('/messages')}
            className="md:hidden p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-darkbg-border rounded-lg transition-all"
            title="Back to conversations list"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Avatar with click-to-open drawer */}
          <div 
            onClick={() => setIsSafetyOpen(!isSafetyOpen)}
            className="relative cursor-pointer hover:opacity-90 shrink-0"
          >
            {otherParticipant?.profile_image ? (
              <img
                src={otherParticipant.profile_image}
                alt={otherParticipant.full_name || 'User'}
                className="h-9 w-9 rounded-full object-cover ring-2 ring-brand-500/10"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-650 dark:text-brand-400 text-xs font-bold ring-2 ring-brand-500/10">
                {otherParticipant?.full_name?.charAt(0).toUpperCase() || 'S'}
              </div>
            )}
            <span className="absolute bottom-0 right-0 block h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-darkbg-card" />
          </div>

          <div className="text-left min-w-0 cursor-pointer" onClick={() => setIsSafetyOpen(!isSafetyOpen)}>
            <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
              <span>{otherParticipant?.full_name || 'Verified Student'}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-250/20 select-none">
                Verified
              </span>
            </h3>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block truncate max-w-[200px] sm:max-w-[320px]">
              {otherParticipant?.department?.name || 'KPRIET Student'}
            </span>
          </div>
        </div>

        {/* Action Header Button */}
        <div className="flex items-center gap-2">
          {activeOrder && (
            <span className={`hidden sm:inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-full border border-opacity-30 ${
              activeOrder.order_status === 'CREATED'
                ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400'
                : activeOrder.order_status === 'SELLER_ACCEPTED'
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400'
                : activeOrder.order_status === 'COMPLETED'
                ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400'
                : 'bg-slate-50 text-slate-500 border-slate-250 dark:bg-slate-800/20 dark:text-slate-400'
            }`}>
              Swap: {activeOrder.order_status === 'CREATED' ? 'Proposed' : activeOrder.order_status === 'SELLER_ACCEPTED' ? 'Scheduled' : activeOrder.order_status}
            </span>
          )}

          <button
            onClick={() => setIsSafetyOpen(!isSafetyOpen)}
            className={`p-2 rounded-xl border transition-all ${
              isSafetyOpen
                ? 'bg-brand-50 text-brand-650 border-brand-200 dark:bg-brand-950/20 dark:border-brand-900/30'
                : 'bg-white hover:bg-slate-50 text-slate-400 border-slate-200/50 hover:text-slate-700 dark:bg-darkbg-card dark:border-darkbg-border dark:hover:text-slate-200'
            }`}
            title="Profile details and safety panel"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Embedded Product Summary Banner */}
      {conversation.product && (
        <div className="px-4 py-2 border-b border-stone-200 dark:border-darkbg-border/60 bg-white/70 dark:bg-darkbg-card/5 backdrop-blur-sm flex items-center justify-between text-left text-xs gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {conversation.product.images && conversation.product.images.length > 0 && (
              <img
                src={conversation.product.images[0]}
                alt={conversation.product.title}
                className="h-9 w-9 rounded-xl object-cover border border-slate-100 dark:border-darkbg-border/40 shrink-0"
              />
            )}
            <div className="truncate">
              <span className="font-extrabold text-slate-800 dark:text-slate-200 block truncate">
                {conversation.product.title}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-slate-900 dark:text-white font-extrabold text-xs">
                  ₹{conversation.product.price}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold bg-slate-100 dark:bg-darkbg-border/50 px-1 rounded">
                  {conversation.product.condition}
                </span>
              </div>
            </div>
          </div>
          <Link
            to={`/listings/${conversation.product.id}`}
            className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-brand-500 hover:text-brand-650 bg-brand-50 dark:bg-brand-900/20 dark:text-brand-400 px-2.5 py-1.5 rounded-full border border-brand-200/20 whitespace-nowrap transition-colors"
          >
            <span>View Item</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Messages Scroll Thread & Inline Swapping Forms */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
        {/* Load older messages button */}
        {messages.length >= msgLimit && (
          <button
            type="button"
            onClick={() => setMsgLimit((prev) => prev + 50)}
            className="w-full text-center text-[10px] text-brand-500 hover:text-brand-650 font-extrabold uppercase py-2 hover:underline border-b border-slate-150/40 dark:border-darkbg-border/20 mb-3"
          >
            Load Older Messages
          </button>
        )}

        {/* Premium Swap Coordination Widget */}
        {activeOrder ? (
          <div className="w-full max-w-lg mx-auto bg-white/70 dark:bg-darkbg-card/40 border border-slate-200/50 dark:border-darkbg-border/60 rounded-3xl p-4 shadow-sm backdrop-blur-md text-left space-y-4">
            
            {/* Horizontal Mini-Stepper */}
            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-darkbg-border/20 pb-2 select-none">
              <div className="flex items-center gap-1.5">
                <span className={`flex h-4.5 w-4.5 items-center justify-center rounded-full font-bold text-[9px] ${
                  activeOrder.order_status === 'CREATED' 
                    ? 'bg-amber-500 text-white' 
                    : 'bg-emerald-500 text-white'
                }`}>
                  {activeOrder.order_status === 'CREATED' ? '1' : <Check className="h-2.5 w-2.5 stroke-[3]" />}
                </span>
                <span className={activeOrder.order_status === 'CREATED' ? 'text-slate-800 dark:text-slate-200 font-extrabold' : ''}>Proposed</span>
              </div>
              <div className={`h-0.5 flex-1 mx-3 ${activeOrder.order_status !== 'CREATED' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
              <div className="flex items-center gap-1.5">
                <span className={`flex h-4.5 w-4.5 items-center justify-center rounded-full font-bold text-[9px] ${
                  activeOrder.order_status === 'SELLER_ACCEPTED'
                    ? 'bg-amber-500 text-white'
                    : activeOrder.order_status === 'COMPLETED'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-850 text-slate-450'
                }`}>
                  {activeOrder.order_status === 'COMPLETED' ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : '2'}
                </span>
                <span className={activeOrder.order_status === 'SELLER_ACCEPTED' ? 'text-slate-800 dark:text-slate-200 font-extrabold' : ''}>Scheduled</span>
              </div>
              <div className={`h-0.5 flex-1 mx-3 ${activeOrder.order_status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
              <div className="flex items-center gap-1.5">
                <span className={`flex h-4.5 w-4.5 items-center justify-center rounded-full font-bold text-[9px] ${
                  activeOrder.order_status === 'COMPLETED' 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-slate-200 dark:bg-slate-850 text-slate-450'
                }`}>
                  3
                </span>
                <span className={activeOrder.order_status === 'COMPLETED' ? 'text-slate-800 dark:text-slate-200 font-extrabold' : ''}>Swapped</span>
              </div>
            </div>

            {/* Coordination Card details depending on Order State */}
            {activeOrder.order_status === 'CREATED' && (
              <div className="space-y-3.5">
                <div className="flex gap-2 text-slate-500 dark:text-slate-400 text-xs leading-normal">
                  <Clock className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                  <div>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200">Meet-up coordination proposed!</p>
                    <div className="mt-1 space-y-1 text-[11px] font-semibold text-slate-500 dark:text-slate-455">
                      <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> <strong>Location:</strong> {activeOrder.meeting?.location}</p>
                      <p className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> <strong>Date & Time:</strong> {activeOrder.meeting?.date} @ {activeOrder.meeting?.time}</p>
                      <p className="flex items-center gap-1"><Info className="h-3.5 w-3.5" /> <strong>Payment:</strong> {activeOrder.meeting?.payment_method}</p>
                    </div>
                  </div>
                </div>

                {/* Inline Forms and Action Buttons */}
                {isRescheduleOpen ? (
                  <form onSubmit={handleRescheduleSubmit} className="border-t border-slate-100 dark:border-darkbg-border/60 pt-3 space-y-3">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Propose Counter-Schedule</h5>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-slate-400">Date</label>
                        <input
                          type="date"
                          value={meetingDate}
                          onChange={(e) => setMeetingDate(e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-slate-400">Time</label>
                        <select
                          value={meetingTime}
                          onChange={(e) => setMeetingTime(e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                        >
                          <option>09:00 AM - 11:00 AM</option>
                          <option>11:00 AM - 01:00 PM</option>
                          <option>01:00 PM - 03:00 PM</option>
                          <option>03:00 PM - 05:00 PM</option>
                          <option>05:00 PM - 07:00 PM</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-400">Location</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Library Entrance, CSE Block Lobby..."
                        value={meetingLocation}
                        onChange={(e) => setMeetingLocation(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => setIsRescheduleOpen(false)}
                        variant="secondary"
                        size="sm"
                        className="flex-1 rounded-xl text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        className="flex-1 rounded-xl text-xs"
                        isLoading={rescheduleMutation.isPending}
                      >
                        Send Counter
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {!isBuyer ? (
                      <>
                        <Button
                          onClick={async () => {
                            await acceptOrderMutation.mutateAsync(activeOrder.id);
                            refetchOrders();
                          }}
                          variant="primary"
                          size="sm"
                          className="flex-1 min-w-[120px] rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          isLoading={acceptOrderMutation.isPending}
                        >
                          Accept Swap
                        </Button>
                        <Button
                          onClick={async () => {
                            if (window.confirm('Decline this swap proposal?')) {
                              await rejectOrderMutation.mutateAsync(activeOrder.id);
                              refetchOrders();
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="flex-1 min-w-[100px] rounded-xl text-xs border-red-200 hover:bg-red-50 text-red-500 dark:border-red-950/30 dark:hover:bg-red-950/20"
                          isLoading={rejectOrderMutation.isPending}
                        >
                          Decline
                        </Button>
                        <Button
                          onClick={() => setIsRescheduleOpen(true)}
                          variant="secondary"
                          size="sm"
                          className="flex-1 min-w-[120px] rounded-xl text-xs"
                        >
                          Reschedule
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] font-bold text-amber-500 italic block py-1.5">
                          Waiting for {otherParticipant?.full_name || 'seller'} to review proposal...
                        </span>
                        <div className="flex w-full gap-2 mt-1">
                          <Button
                            onClick={() => setIsRescheduleOpen(true)}
                            variant="secondary"
                            size="sm"
                            className="flex-1 rounded-xl text-xs"
                          >
                            Reschedule
                          </Button>
                          <Button
                            onClick={async () => {
                              const reason = window.prompt('Reason for cancelling:');
                              if (reason !== null) {
                                await cancelMutation.mutateAsync({ orderId: activeOrder.id, reason: reason.trim() });
                                refetchOrders();
                              }
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-1 rounded-xl text-xs border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-darkbg-border dark:hover:bg-darkbg-body/25"
                            isLoading={cancelMutation.isPending}
                          >
                            Cancel Request
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeOrder.order_status === 'SELLER_ACCEPTED' && (
              <div className="space-y-4">
                {activeOrder.meeting?.status === 'PROPOSED' ? (
                  /* Reschedule Proposal Pending */
                  <div className="space-y-3.5">
                    <div className="flex gap-2.5 text-slate-500 dark:text-slate-450 text-xs leading-normal">
                      <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                      <div>
                        <p className="font-extrabold text-slate-800 dark:text-slate-200">Reschedule Counter-Proposal Proposed!</p>
                        <div className="mt-1 space-y-1 text-[11px] font-semibold text-slate-500 dark:text-slate-455">
                          <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> <strong>New Location:</strong> {activeOrder.meeting?.location}</p>
                          <p className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> <strong>New Date & Time:</strong> {activeOrder.meeting?.date} @ {activeOrder.meeting?.time}</p>
                        </div>
                      </div>
                    </div>

                    {isRescheduleOpen ? (
                      <form onSubmit={handleRescheduleSubmit} className="border-t border-slate-100 dark:border-darkbg-border/60 pt-3.5 space-y-3 mt-2">
                        <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Propose New Reschedule</h5>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase text-slate-400">Date</label>
                            <input
                              type="date"
                              value={meetingDate}
                              onChange={(e) => setMeetingDate(e.target.value)}
                              className="w-full p-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase text-slate-400">Time</label>
                            <select
                              value={meetingTime}
                              onChange={(e) => setMeetingTime(e.target.value)}
                              className="w-full p-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                            >
                              <option>09:00 AM - 11:00 AM</option>
                              <option>11:00 AM - 01:00 PM</option>
                              <option>01:00 PM - 03:00 PM</option>
                              <option>03:00 PM - 05:00 PM</option>
                              <option>05:00 PM - 07:00 PM</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-slate-400">Location</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Library Entrance, CSE Block Lobby..."
                            value={meetingLocation}
                            onChange={(e) => setMeetingLocation(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={() => setIsRescheduleOpen(false)}
                            variant="secondary"
                            size="sm"
                            className="flex-1 rounded-xl text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            className="flex-1 rounded-xl text-xs"
                            isLoading={rescheduleMutation.isPending}
                          >
                            Send Counter Proposal
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-2 pt-1">
                        <Button
                          onClick={async () => {
                            await acceptRescheduleMutation.mutateAsync(activeOrder.id);
                            refetchOrders();
                          }}
                          variant="primary"
                          size="sm"
                          className="w-full rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          isLoading={acceptRescheduleMutation.isPending}
                        >
                          Accept Rescheduled Proposal
                        </Button>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setIsRescheduleOpen(true)}
                            variant="secondary"
                            size="sm"
                            className="flex-1 rounded-xl text-xs"
                          >
                            Counter Proposal
                          </Button>
                          <Button
                            onClick={async () => {
                              const reason = window.prompt('Specify cancel reason:');
                              if (reason !== null) {
                                await cancelMutation.mutateAsync({ orderId: activeOrder.id, reason: reason.trim() });
                                refetchOrders();
                              }
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-1 rounded-xl text-xs border-red-150 hover:bg-red-50 text-red-500 dark:border-red-950/20 dark:hover:bg-red-950/10"
                            isLoading={cancelMutation.isPending}
                          >
                            Cancel Swap
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Regular Scheduled State */
                  <>
                    <div className="flex gap-2.5 text-slate-500 dark:text-slate-455 text-xs leading-normal">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      <div>
                        <p className="font-extrabold text-slate-800 dark:text-slate-200">Meet-up Scheduled & Active!</p>
                        <div className="mt-1 space-y-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-450">
                          <p className="flex items-center gap-1.5 text-slate-800 dark:text-slate-100 bg-emerald-500/5 dark:bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/10"><MapPin className="h-4 w-4 text-emerald-500" /> {activeOrder.meeting?.location}</p>
                          <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Date & Time: {activeOrder.meeting?.date} @ {activeOrder.meeting?.time}</p>
                          <p className="flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Payment Method: {activeOrder.meeting?.payment_method}</p>
                        </div>
                      </div>
                    </div>

                    {/* Progress Verification Checkbox Checklist */}
                    <div className="p-3 bg-slate-50/50 dark:bg-darkbg-body/20 border border-slate-100 dark:border-darkbg-border/40 rounded-xl space-y-2 text-[11px] font-semibold text-slate-500">
                      <h6 className="font-extrabold uppercase text-[9px] tracking-wider text-slate-400">Trade checklist</h6>
                      <p className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-500 stroke-[3]" /> 1. Meet student on-campus safely.</p>
                      <p className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-500 stroke-[3]" /> 2. Inspect item quality details.</p>
                      <p className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-500 stroke-[3]" /> 3. Perform payment (₹{activeOrder.amount}).</p>
                      <p className="flex items-center gap-1.5">
                        {activeOrder.meeting?.confirmation?.buyer_confirmed && isBuyer ? (
                          <Check className="h-3 w-3 text-emerald-500 stroke-[3]" />
                        ) : activeOrder.meeting?.confirmation?.seller_confirmed && !isBuyer ? (
                          <Check className="h-3 w-3 text-emerald-500 stroke-[3]" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping inline-block mr-1.5 shrink-0" />
                        )}
                        4. Confirm transaction below.
                      </p>
                    </div>

                    {/* Confirmation States & Buttons */}
                    <div className="flex flex-col gap-2 pt-1">
                      {/* Status labels */}
                      <div className="text-[10px] font-extrabold space-y-1">
                        {activeOrder.meeting?.confirmation?.buyer_confirmed && (
                          <p className="text-emerald-500 flex items-center gap-1">✓ Buyer has confirmed meeting completion.</p>
                        )}
                        {activeOrder.meeting?.confirmation?.seller_confirmed && (
                          <p className="text-emerald-500 flex items-center gap-1">✓ Seller has confirmed meeting completion.</p>
                        )}
                      </div>

                      {/* Complete button */}
                      {((isBuyer && !activeOrder.meeting?.confirmation?.buyer_confirmed) ||
                        (!isBuyer && !activeOrder.meeting?.confirmation?.seller_confirmed)) ? (
                        <Button
                          onClick={async () => {
                            if (window.confirm('Verify that you have met, inspected the listing, and received/sent payment? This action is permanent.')) {
                              await completeOrderMutation.mutateAsync(activeOrder.id);
                              refetchOrders();
                            }
                          }}
                          variant="primary"
                          size="sm"
                          className="w-full rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          isLoading={completeOrderMutation.isPending}
                        >
                          Confirm Meet & Complete Swap
                        </Button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-bold italic text-center py-2 bg-slate-100 dark:bg-darkbg-border/20 rounded-xl block">
                          Waiting for other student to confirm completion...
                        </span>
                      )}

                      {/* Reschedule or Cancel option during active meet */}
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setIsRescheduleOpen(!isRescheduleOpen)}
                          variant="secondary"
                          size="sm"
                          className="flex-1 rounded-xl text-xs"
                        >
                          Propose Reschedule
                        </Button>
                        <Button
                          onClick={async () => {
                            const reason = window.prompt('Specify cancel reason:');
                            if (reason !== null) {
                              await cancelMutation.mutateAsync({ orderId: activeOrder.id, reason: reason.trim() });
                              refetchOrders();
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-xl text-xs border-red-150 hover:bg-red-50 text-red-500 dark:border-red-950/20 dark:hover:bg-red-950/10"
                          isLoading={cancelMutation.isPending}
                        >
                          Cancel Swap
                        </Button>
                      </div>

                      {isRescheduleOpen && (
                        <form onSubmit={handleRescheduleSubmit} className="border-t border-slate-100 dark:border-darkbg-border/60 pt-3.5 space-y-3 mt-2">
                          <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Propose New Reschedule</h5>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase text-slate-400">Date</label>
                              <input
                                type="date"
                                value={meetingDate}
                                onChange={(e) => setMeetingDate(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase text-slate-400">Time</label>
                              <select
                                value={meetingTime}
                                onChange={(e) => setMeetingTime(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                              >
                                <option>09:00 AM - 11:00 AM</option>
                                <option>11:00 AM - 01:00 PM</option>
                                <option>01:00 PM - 03:00 PM</option>
                                <option>03:00 PM - 05:00 PM</option>
                                <option>05:00 PM - 07:00 PM</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase text-slate-400">Location</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Library Entrance, CSE Block Lobby..."
                              value={meetingLocation}
                              onChange={(e) => setMeetingLocation(e.target.value)}
                              className="w-full p-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={() => setIsRescheduleOpen(false)}
                              variant="secondary"
                              size="sm"
                              className="flex-1 rounded-xl text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              variant="primary"
                              size="sm"
                              className="flex-1 rounded-xl text-xs"
                              isLoading={rescheduleMutation.isPending}
                            >
                              Send Counter Proposal
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeOrder.order_status === 'COMPLETED' && (
              <div className="p-2 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 rounded-2xl flex items-start gap-2.5">
                <HeartHandshake className="h-5 w-5 text-emerald-500 shrink-0" />
                <div className="text-xs">
                  <p className="font-extrabold text-slate-800 dark:text-slate-100">Swap Completed Successfully!</p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Verified transaction archived. Thank you for swapping safely within SemesterSwap.</p>
                </div>
              </div>
            )}

            {activeOrder.order_status === 'CANCELLED' && (
              <div className="p-2 bg-red-500/5 dark:bg-red-500/10 border border-red-500/15 rounded-2xl flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                <div className="text-xs">
                  <p className="font-extrabold text-slate-800 dark:text-slate-150">Swap Coordination Cancelled</p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    <strong>Reason:</strong> {activeOrder.cancel_reason || 'Declined / Cancelled by student.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* No active coordination: Propose Meeting button for buyer */
          isBuyer && conversation.product?.status === 'available' && (
            <div className="w-full max-w-lg mx-auto bg-white/70 dark:bg-darkbg-card/40 border border-slate-200/50 dark:border-darkbg-border/60 rounded-3xl p-4 shadow-sm backdrop-blur-md text-left space-y-3.5">
              <div className="flex gap-2 items-start text-xs">
                <HeartHandshake className="h-5 w-5 text-brand-500 shrink-0" />
                <div>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200">Ready to swap? Propose a meeting!</p>
                  <p className="text-[11px] font-semibold text-slate-450 dark:text-slate-400 mt-0.5">Choose a secure college meeting location and inspect the item before finalizing payment.</p>
                </div>
              </div>

              {isProposeOpen ? (
                <form onSubmit={handleProposeMeeting} className="space-y-3 pt-2.5 border-t border-slate-100 dark:border-darkbg-border/65">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-400">Date</label>
                      <input
                        type="date"
                        value={meetingDate}
                        onChange={(e) => setMeetingDate(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-400">Time</label>
                      <select
                        value={meetingTime}
                        onChange={(e) => setMeetingTime(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                      >
                        <option>09:00 AM - 11:00 AM</option>
                        <option>11:00 AM - 01:00 PM</option>
                        <option>01:00 PM - 03:00 PM</option>
                        <option>03:00 PM - 05:00 PM</option>
                        <option>05:00 PM - 07:00 PM</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-400">Campus Meeting Location</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Library Entrance, CSE Block Lobby..."
                      value={meetingLocation}
                      onChange={(e) => setMeetingLocation(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-400">Payment Option</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('UPI')}
                          className={`flex-1 py-1.5 rounded-xl border text-xs font-bold text-center transition-all ${
                            paymentMethod === 'UPI'
                              ? 'bg-brand-500 text-white border-brand-500 dark:bg-brand-500'
                              : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-darkbg-body dark:border-darkbg-border dark:text-slate-400'
                          }`}
                        >
                          UPI
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('CASH')}
                          className={`flex-1 py-1.5 rounded-xl border text-xs font-bold text-center transition-all ${
                            paymentMethod === 'CASH'
                              ? 'bg-brand-500 text-white border-brand-500 dark:bg-brand-500'
                              : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-darkbg-body dark:border-darkbg-border dark:text-slate-400'
                          }`}
                        >
                          CASH
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-400">Optional message</label>
                      <input
                        type="text"
                        value={coordinationMessage}
                        onChange={(e) => setCoordinationMessage(e.target.value)}
                        placeholder="Say hi or add details..."
                        className="w-full p-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      onClick={() => setIsProposeOpen(false)}
                      variant="secondary"
                      size="sm"
                      className="flex-1 rounded-xl text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      className="flex-1 rounded-xl text-xs"
                      isLoading={createOrderMutation.isPending}
                    >
                      Send Swap Proposal
                    </Button>
                  </div>
                </form>
              ) : (
                <Button
                  onClick={() => setIsProposeOpen(true)}
                  variant="primary"
                  size="sm"
                  className="w-full rounded-xl text-xs py-2 px-4 shadow shadow-brand-500/10 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold border-none"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span>Propose Swap Meeting</span>
                </Button>
              )}
            </div>
          )
        )}

        {/* Message bubbles mapping */}
        <div className="flex-1 flex flex-col gap-3 pt-2">
          {isMessagesLoading ? (
            <div className="space-y-4">
              <Skeleton variant="text" className="h-10 w-1/3 rounded-2xl ml-auto" />
              <Skeleton variant="text" className="h-12 w-1/2 rounded-2xl" />
              <Skeleton variant="text" className="h-8 w-1/4 rounded-2xl ml-auto" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-xs mx-auto text-slate-400 dark:text-slate-500 text-xs py-12 space-y-2">
              <Info className="h-5 w-5 stroke-[1.5] text-slate-350" />
              <span>Say hi to open your trade options. Keep communications verified within SemesterSwap.</span>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === user?.id;
              const isImage = msg.content.startsWith('[image]');
              const formattedTime = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[75%] ${isMe ? 'ml-auto items-end animate-fade-in' : 'mr-auto items-start animate-fade-in'}`}
                >
                  {isImage ? (
                    /* Render image message bubble */
                    <div
                      onClick={() => setZoomImageUrl(msg.content.substring(7))}
                      className="cursor-zoom-in rounded-2xl overflow-hidden shadow-sm border border-stone-250 dark:border-darkbg-border/60 hover:opacity-95 transition-all max-w-[280px]"
                    >
                      <img
                        src={msg.content.substring(7)}
                        alt="Chat Image Attachment"
                        className="w-full h-auto max-h-60 object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    /* Render normal text message bubble */
                    <div
                      className={`px-4 py-2.5 text-xs text-left leading-relaxed rounded-2xl ${
                        isMe
                          ? 'bg-gradient-to-tr from-brand-500 to-brand-600 text-white rounded-tr-none shadow shadow-brand-500/10'
                          : 'bg-white dark:bg-darkbg-card border border-stone-200 dark:border-darkbg-border/60 text-slate-800 dark:text-slate-200 rounded-tl-none shadow-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                  )}
                  
                  {/* Meta details (timestamp & read receipt status) */}
                  <div className="flex items-center gap-1.5 mt-1 text-[9px] text-slate-400 font-bold select-none">
                    <span>{formattedTime}</span>
                    {isMe && (
                      <span className="flex items-center shrink-0">
                        {msg.is_read ? (
                          <span title="Read"><CheckCheck className="h-3 w-3 text-brand-500" /></span>
                        ) : (
                          <span title="Delivered"><Check className="h-3 w-3 text-slate-350 dark:text-slate-650" /></span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Real-time typing status bubble indicator */}
          {typingUser && (
            <div className="flex flex-col mr-auto items-start max-w-[80%] animate-pulse">
              <div className="px-4 py-2 bg-slate-100 dark:bg-darkbg-card text-slate-550 dark:text-slate-400 text-xs rounded-2xl rounded-tl-none flex items-center gap-1.5 shadow-sm border border-slate-200/20">
                <span className="italic font-bold">{typingUser} is typing</span>
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Message input bar with Smart Quick Replies */}
      <div className="bg-white dark:bg-darkbg-card/10 border-t-2 border-stone-300 dark:border-darkbg-border/80 p-3 space-y-3 z-10">
        
        {/* Quick replies list */}
        {messages.length < 15 && (
          <div className="flex gap-2 overflow-x-auto pb-1 select-none no-scrollbar">
            {quickReplies.map((reply, i) => (
              <button
                key={i}
                onClick={() => handleQuickReply(reply)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-darkbg-body dark:hover:bg-darkbg-border/60 text-slate-600 dark:text-slate-350 text-[10px] font-bold rounded-full border border-slate-200/40 dark:border-darkbg-border/40 whitespace-nowrap active:scale-95 transition-all"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {/* Action input form */}
        <form onSubmit={handleSend} className="flex items-center gap-2">
          {/* Hidden File Input for Image Upload */}
          <input
            type="file"
            id="chat-image-input"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageUpload}
            className="sr-only"
            disabled={uploadImageMutation.isPending || sendMutation.isPending}
          />
          
          <button
            type="button"
            onClick={() => document.getElementById('chat-image-input')?.click()}
            disabled={uploadImageMutation.isPending || sendMutation.isPending}
            className="p-2.5 rounded-2xl border-2 border-stone-300 hover:border-brand-500 hover:bg-slate-50 text-slate-400 hover:text-brand-500 dark:border-darkbg-border dark:hover:border-brand-500 dark:hover:bg-darkbg-body dark:text-slate-550 transition-all shrink-0 active:scale-95 disabled:opacity-50 flex items-center justify-center"
            title="Upload image"
          >
            {uploadImageMutation.isPending ? (
              <svg className="animate-spin h-4.5 w-4.5 text-brand-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <ImageIcon className="h-4.5 w-4.5" />
            )}
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={messageText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={uploadImageMutation.isPending ? "Uploading image..." : "Type your message..."}
            disabled={sendMutation.isPending || uploadImageMutation.isPending}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200/60 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border/60 dark:focus:border-brand-500 rounded-2xl outline-none text-xs text-slate-800 dark:text-slate-200 disabled:opacity-50 transition-all focus:ring-2 focus:ring-brand-500/10 resize-none overflow-y-auto max-h-[120px]"
          />
          <Button
            type="submit"
            disabled={!messageText.trim() || sendMutation.isPending || uploadImageMutation.isPending}
            variant="primary"
            className="p-2.5 rounded-2xl shadow shadow-brand-500/10 active:scale-95 shrink-0 flex items-center justify-center bg-brand-500 hover:bg-brand-600"
            title="Send message"
          >
            <Send className="h-4 w-4 text-slate-900" />
          </Button>
        </form>
      </div>

      {/* Zoom Image Overlay Modal */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setZoomImageUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-slate-350 p-2.5 bg-black/30 rounded-full transition-all hover:scale-105 active:scale-95"
            onClick={() => setZoomImageUrl(null)}
            title="Close zoom image view"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={zoomImageUrl}
            alt="Zoomed attachment preview"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl transition-all"
          />
        </div>
      )}
    </div>
  );
};

/* Side-panel details drawer displaying student profile trust profile & block/report forms */
interface ProfileDrawerProps {
  otherUser: any;
  productId: string;
  onClose: () => void;
}

const ProfileDetailsDrawer: React.FC<ProfileDrawerProps> = ({ otherUser, productId, onClose }) => {
  // Fetch full trust profile details
  const { data: trustProfile, isLoading } = useTrustProfileQuery(otherUser.id);
  
  // Safety actions mutations
  const blockMutation = useBlockUserMutation();
  const reportMutation = useReportUserOrListingMutation();
  const [reportReason, setReportReason] = useState('');

  const handleBlock = async () => {
    if (window.confirm(`Are you sure you want to block ${otherUser.full_name || 'this student'}? This will disconnect your chats.`)) {
      try {
        await blockMutation.mutateAsync(otherUser.id);
        onClose();
        window.location.reload();
      } catch (err) {}
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason.trim()) return;

    try {
      await reportMutation.mutateAsync({
        reported_user_id: otherUser.id,
        listing_id: productId,
        reason: reportReason
      });
      setReportReason('');
      showToast('Student user has been reported to administration.', 'success');
      onClose();
    } catch (err) {}
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto text-left relative bg-white dark:bg-darkbg-card">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-100 dark:border-darkbg-border/60 flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1">
          <Shield className="h-4 w-4 text-brand-500" />
          Student Trust Profile
        </span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          title="Close drawer panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-5 flex-1 space-y-6">
        {/* Basic Avatar and Identity info */}
        <div className="text-center space-y-2 flex flex-col items-center">
          {otherUser.profile_image ? (
            <img
              src={otherUser.profile_image}
              alt={otherUser.full_name || 'User'}
              className="h-16 w-16 rounded-full object-cover ring-4 ring-brand-500/10 shadow-sm"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-650 dark:text-brand-400 text-xl font-bold ring-4 ring-brand-500/10 shadow-sm">
              {otherUser.full_name?.charAt(0).toUpperCase() || 'S'}
            </div>
          )}
          
          <div>
            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
              {otherUser.full_name || 'Verified Student'}
            </h4>
            <p className="text-[11px] text-slate-500 font-semibold">{otherUser.email}</p>
          </div>
        </div>

        {/* Trust Profile Metadata */}
        {isLoading ? (
          <div className="space-y-3.5">
            <Skeleton variant="text" className="h-5 w-full" />
            <Skeleton variant="rectangular" className="h-20 rounded-xl" />
            <Skeleton variant="text" className="h-5 w-2/3" />
          </div>
        ) : trustProfile ? (
          <div className="space-y-5">
            
            {/* Reliability Rating Progress Gauge */}
            <div className="p-4 bg-slate-50/50 dark:bg-darkbg-border/20 rounded-2xl border border-slate-100 dark:border-darkbg-border/40 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-extrabold">
                <span className="text-slate-850 dark:text-slate-200">Reputation Trust Score</span>
                <span className="text-brand-500 dark:text-brand-400">{trustProfile.trust_score}%</span>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-500 rounded-full"
                  style={{ width: `${trustProfile.trust_score}%` }}
                />
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-450 dark:text-slate-400 font-bold select-none">
                <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span>Verified student badge status approved.</span>
              </div>
            </div>

            {/* Stat Counters */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-3 bg-slate-50/30 dark:bg-darkbg-border/10 rounded-xl border border-slate-100 dark:border-darkbg-border/40">
                <span className="block text-base font-extrabold text-slate-800 dark:text-white">
                  {trustProfile.completed_transactions}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">Swaps</span>
              </div>
              <div className="p-3 bg-slate-50/30 dark:bg-darkbg-border/10 rounded-xl border border-slate-100 dark:border-darkbg-border/40">
                <span className="block text-base font-extrabold text-slate-800 dark:text-white">
                  {trustProfile.products_sold}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">Sold</span>
              </div>
            </div>

            {/* Rating Stars Details */}
            <div className="space-y-1 bg-slate-50/30 dark:bg-darkbg-border/10 p-3 rounded-2xl border border-slate-100 dark:border-darkbg-border/40">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500 dark:text-slate-400">Rating</span>
                <span className="text-slate-800 dark:text-white font-extrabold">{trustProfile.rating.toFixed(1)} / 5.0</span>
              </div>
              <div className="flex text-amber-400 gap-0.5 mt-1.5 justify-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < Math.round(trustProfile.rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-200 dark:text-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* College Metadata Details */}
            <div className="space-y-2 text-xs font-semibold text-slate-550 dark:text-slate-400">
              <p className="flex items-center gap-2"><Award className="h-4 w-4 text-slate-400" /> College: {trustProfile.college_name}</p>
              <p className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-slate-400" /> Dept: {trustProfile.department_name}</p>
              {trustProfile.admission_year && (
                <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400" /> Admission Year: {trustProfile.admission_year}</p>
              )}
            </div>

          </div>
        ) : (
          <div className="text-slate-400 text-xs text-center py-4">
            Could not fetch trust metrics for this student.
          </div>
        )}

        {/* Safety Settings Section */}
        <div className="border-t border-slate-100 dark:border-darkbg-border/50 pt-5 space-y-4">
          <h5 className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Safety & Moderation</h5>
          
          <div className="space-y-4">
            {/* Block Button */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-450 dark:text-slate-500 leading-normal">
                Blocking this student will hide your listings and immediately end message exchanges.
              </p>
              <Button
                onClick={handleBlock}
                variant="danger"
                size="sm"
                className="w-full text-xs font-bold rounded-xl py-2 shrink-0"
                isLoading={blockMutation.isPending}
              >
                Block Student
              </Button>
            </div>

            {/* Report Form */}
            <form onSubmit={handleReport} className="border-t border-slate-100 dark:border-darkbg-border/40 pt-4 space-y-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Report Violation
                </label>
                <textarea
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Reason for report (e.g. spam, scam, policy violations, harassment...)"
                  className="w-full px-2.5 py-1.5 border border-slate-200/80 focus:border-red-400 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-red-400 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200 transition-all focus:ring-1 focus:ring-red-400/20"
                  required
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="w-full text-xs font-bold border-red-200 hover:bg-red-50 text-red-500 dark:border-red-950/30 dark:hover:bg-red-950/10 rounded-xl py-2"
                isLoading={reportMutation.isPending}
              >
                <Flag className="h-3.5 w-3.5 mr-1" />
                Submit Report
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InboxPage;

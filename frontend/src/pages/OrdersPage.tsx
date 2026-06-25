import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuyerOrdersQuery, useSellerOrdersQuery } from '../hooks/useOrders';
import type { Order } from '../hooks/useOrders';
import { Card, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import {
  ShoppingBag,
  DollarSign,
  ArrowRight,
  User,
  Calendar,
  AlertCircle,
  MapPin,
  AlertTriangle,
} from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  // Auth context
  
  // Tabs: 'purchases' (buyer) vs 'sales' (seller)
  const [activeTab, setActiveTab] = useState<'purchases' | 'sales'>('purchases');

  // React Query Queries
  const { data: purchases = [], isLoading: isLoadingPurchases } = useBuyerOrdersQuery();
  const { data: sales = [], isLoading: isLoadingSales } = useSellerOrdersQuery();

  const newSalesCount = sales.filter(
    (order) =>
      order.order_status === 'CREATED' ||
      (order.meeting?.status === 'PROPOSED' &&
        order.order_status !== 'CANCELLED' &&
        order.order_status !== 'EXPIRED' &&
        order.order_status !== 'COMPLETED')
  ).length;

  const newPurchasesCount = purchases.filter(
    (order) =>
      order.meeting?.status === 'PROPOSED' &&
      order.order_status !== 'CREATED' &&
      order.order_status !== 'CANCELLED' &&
      order.order_status !== 'EXPIRED' &&
      order.order_status !== 'COMPLETED'
  ).length;

  const isLoading = isLoadingPurchases || isLoadingSales;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Status Badge Renderers
  const getOrderStatusBadge = (status: Order['order_status']) => {
    const styles: Record<Order['order_status'], string> = {
      CREATED: 'bg-slate-50 text-slate-650 border-slate-205 dark:bg-darkbg-border/20 dark:text-slate-400 dark:border-darkbg-border/60',
      PAYMENT_PENDING: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30',
      PAID: 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30',
      SELLER_ACCEPTED: 'bg-teal-50 text-teal-650 border-teal-205 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/30',
      COMPLETED: 'bg-emerald-50 text-emerald-600 border-emerald-250/30 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-950/30',
      CANCELLED: 'bg-red-50 text-red-600 border-red-250/30 dark:bg-red-950/20 dark:text-red-400 dark:border-red-950/30',
      EXPIRED: 'bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-neutral-900/20 dark:text-neutral-400 dark:border-neutral-900/30',
    };

    const labels: Record<Order['order_status'], string> = {
      CREATED: 'Meeting Proposed',
      PAYMENT_PENDING: 'Meeting Confirmed',
      PAID: 'Meeting Confirmed',
      SELLER_ACCEPTED: 'Meeting Confirmed',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled/Declined',
      EXPIRED: 'Expired',
    };

    return (
      <span className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full border ${styles[status]}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getPaymentStatusBadge = (_status: Order['payment_status'], method: Order['payment_method']) => {
    return (
      <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full border bg-slate-50 text-slate-500 border-slate-200 dark:bg-darkbg-border/20 dark:text-slate-400 dark:border-darkbg-border/60">
        {method === 'CASH' ? 'Cash Swap' : 'UPI Swap'}
      </span>
    );
  };

  const ongoingPurchases = purchases.filter(
    (order) =>
      order.order_status !== 'COMPLETED' &&
      order.order_status !== 'CANCELLED' &&
      order.order_status !== 'EXPIRED'
  );

  const completedPurchases = purchases.filter(
    (order) => order.order_status === 'COMPLETED'
  );

  const cancelledPurchases = purchases.filter(
    (order) => order.order_status === 'CANCELLED' || order.order_status === 'EXPIRED'
  );

  const renderOrderCard = (order: Order) => {
    const displayUser = activeTab === 'purchases' ? order.seller : order.buyer;
    const product = order.product;

    return (
      <Card
        key={order.id}
        hoverEffect
        onClick={() => navigate(`/order-tracking/${order.id}`)}
        className="cursor-pointer overflow-hidden border border-slate-200/50 dark:border-darkbg-border/60 group bg-white dark:bg-darkbg-card p-0"
      >
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          {/* Left block: product thumbnail and details */}
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-darkbg-body shrink-0 border border-slate-200/40 dark:border-darkbg-border/40">
              {product && product.images && product.images.length > 0 ? (
                <img
                  src={product.images[0]}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-350">
                  <ShoppingBag className="h-6 w-6" />
                </div>
              )}
            </div>
            
            <div className="text-left space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-white line-clamp-1 group-hover:text-brand-500 transition-colors">
                  {product ? product.title : 'Deleted Listing'}
                </h4>
                {((activeTab === 'sales' && order.order_status === 'CREATED') ||
                  (order.meeting?.status === 'PROPOSED' &&
                    order.order_status !== 'CREATED' &&
                    order.order_status !== 'CANCELLED' &&
                    order.order_status !== 'EXPIRED' &&
                    order.order_status !== 'COMPLETED')) && (
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" title="Action Pending" />
                )}
              </div>
              
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Calendar className="h-3.5 w-3.5" />
                <span>Ordered {formatDate(order.created_at)}</span>
              </div>
              
              {order.order_status === 'CREATED' && order.expires_at && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                  ⚠️ Proposal Expires: {new Date(order.expires_at).toLocaleDateString()} at {new Date(order.expires_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              )}
              
              {order.order_status === 'EXPIRED' && (
                <div className="text-[10px] text-red-500 font-bold">
                  Expired
                </div>
              )}
              
              {/* Counterparty name */}
              {displayUser && (
                <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <User className="h-3 w-3" />
                  <span>
                    {activeTab === 'purchases' ? 'Seller' : 'Buyer'}:{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {displayUser.full_name || 'Student'}
                    </span>
                  </span>
                </div>
              )}

              {/* Proposed/Arranged meeting card */}
              {order.meeting && (
                <div className="mt-2 text-xs bg-slate-50 dark:bg-darkbg-body p-2.5 rounded-xl border border-slate-100 dark:border-darkbg-border/50 text-slate-500 space-y-1.5 font-medium leading-normal max-w-xs">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-brand-500 shrink-0" />
                    <span><strong>Schedule:</strong> {order.meeting.date} ({order.meeting.time})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-brand-500 shrink-0" />
                    <span><strong>Location:</strong> {order.meeting.location}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right block: statuses & action button */}
          <div className="flex sm:flex-col items-end justify-between sm:justify-start w-full sm:w-auto gap-3 border-t sm:border-0 border-slate-100 dark:border-darkbg-border/30 pt-3 sm:pt-0 shrink-0">
            
            {/* Price and status badges */}
            <div className="space-y-1 text-right">
              <p className="font-black text-slate-900 dark:text-white text-base">
                {formatPrice(order.amount)}
              </p>
              
              <div className="flex flex-wrap gap-1.5 justify-end">
                {getOrderStatusBadge(order.order_status)}
                {getPaymentStatusBadge(order.payment_status, order.payment_method)}
              </div>
            </div>

            {/* View Details pointer */}
            <span className="text-[11px] font-bold text-brand-500 dark:text-brand-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform select-none sm:pt-1">
              <span>Track Status</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </span>

          </div>

        </CardContent>
      </Card>
    );
  };

  const activeOrdersList = activeTab === 'purchases' ? purchases : sales;

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left animate-fade-in pb-16">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight">
            Orders dashboard
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Manage your purchases, incoming requests, and swap trackings.
          </p>
        </div>
      </div>

      {/* Safety Guidelines Banner */}
      <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-250/20 p-4.5 rounded-2xl flex gap-3 text-left">
        <AlertTriangle className="h-5.5 w-5.5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <h4 className="font-extrabold text-amber-800 dark:text-amber-400">
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

      {/* Tabs Row */}
      <div className="flex border-b border-slate-200/60 dark:border-darkbg-border/60">
        <button
          onClick={() => setActiveTab('purchases')}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'purchases'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-500'
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          <span>My Purchases ({purchases.length})</span>
          {newPurchasesCount > 0 && (
            <span className="flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
              {newPurchasesCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'sales'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-500'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          <span>Incoming Sales ({sales.length})</span>
          {newSalesCount > 0 && (
            <span className="flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
              {newSalesCount}
            </span>
          )}
        </button>
      </div>

      {/* Content Section */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton variant="rectangular" className="h-28 rounded-2xl" />
          <Skeleton variant="rectangular" className="h-28 rounded-2xl" />
          <Skeleton variant="rectangular" className="h-28 rounded-2xl" />
        </div>
      ) : activeOrdersList.length === 0 ? (
        /* Empty State */
        <Card className="py-16 text-center max-w-lg mx-auto border-dashed border-2 border-slate-200 dark:border-darkbg-border">
          <CardContent className="space-y-5 flex flex-col items-center">
            <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-darkbg-body flex items-center justify-center text-slate-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-white text-base">
                {activeTab === 'purchases' ? 'No purchases yet' : 'No sales requests yet'}
              </h3>
              <p className="text-slate-400 dark:text-slate-500 text-xs leading-normal mt-1 max-w-xs mx-auto">
                {activeTab === 'purchases'
                  ? "When you buy an item, you'll see the reservation and status updates here."
                  : 'Listing items in the marketplace is the best way to get swaps and swap proposals!'}
              </p>
            </div>
            <Button
              onClick={() => navigate(activeTab === 'purchases' ? '/' : '/sell')}
              variant="primary"
              className="font-bold text-xs px-5 py-2.5"
            >
              {activeTab === 'purchases' ? 'Browse Marketplace' : 'List a New Item'}
            </Button>
          </CardContent>
        </Card>
      ) : activeTab === 'purchases' ? (
        /* Split My Purchases into sections */
        <div className="space-y-10">
          {ongoingPurchases.length > 0 && (
            <div className="space-y-4 text-left">
              <h3 className="font-extrabold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-1 flex items-center gap-1.5">
                <span>Ongoing Purchases</span>
                <span className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-darkbg-border/30 text-slate-500 dark:text-slate-400 rounded-full font-bold">
                  {ongoingPurchases.length}
                </span>
              </h3>
              <div className="space-y-4">
                {ongoingPurchases.map(renderOrderCard)}
              </div>
            </div>
          )}
          
          {completedPurchases.length > 0 && (
            <div className="space-y-4 text-left">
              <h3 className="font-extrabold text-xs text-emerald-600 dark:text-emerald-500 uppercase tracking-wider pl-1 flex items-center gap-1.5">
                <span>Completed</span>
                <span className="px-2 py-0.5 text-[10px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-500 rounded-full font-bold">
                  {completedPurchases.length}
                </span>
              </h3>
              <div className="space-y-4">
                {completedPurchases.map(renderOrderCard)}
              </div>
            </div>
          )}

          {cancelledPurchases.length > 0 && (
            <div className="space-y-4 text-left">
              <h3 className="font-extrabold text-xs text-red-500 dark:text-red-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
                <span>Cancelled</span>
                <span className="px-2 py-0.5 text-[10px] bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 rounded-full font-bold">
                  {cancelledPurchases.length}
                </span>
              </h3>
              <div className="space-y-4">
                {cancelledPurchases.map(renderOrderCard)}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Incoming Sales List */
        <div className="space-y-4">
          {sales.map(renderOrderCard)}
        </div>
      )}

    </div>
  );
};
export default OrdersPage;

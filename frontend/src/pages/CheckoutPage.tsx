import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export const CheckoutPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (productId) {
      navigate(`/listings/${productId}`, { replace: true });
    } else {
      navigate('/marketplace', { replace: true });
    }
  }, [productId, navigate]);

  return null;
};
export default CheckoutPage;

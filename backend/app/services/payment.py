from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Dict, Any, Optional
import uuid

class PaymentService(ABC):
    @abstractmethod
    def process_payment(
        self,
        order_id: uuid.UUID,
        amount: Decimal,
        payment_method: str,
        success: bool = True
    ) -> Dict[str, Any]:
        """
        Process a payment and return transaction details.
        """
        pass

    @abstractmethod
    def refund_payment(
        self,
        transaction_id: str,
        amount: Decimal
    ) -> Dict[str, Any]:
        """
        Refund a transaction.
        """
        pass


class MockPaymentService(PaymentService):
    def process_payment(
        self,
        order_id: uuid.UUID,
        amount: Decimal,
        payment_method: str,
        success: bool = True
    ) -> Dict[str, Any]:
        """
        Simulate processing online card/UPI mock gateway payments.
        """
        if not success:
            return {
                "success": False,
                "transaction_id": None,
                "error": "Declined by mock bank gateway."
            }

        # Generate mock transaction reference
        transaction_id = f"TXN{uuid.uuid4().hex[:8].upper()}"
        
        return {
            "success": True,
            "transaction_id": transaction_id,
            "error": None
        }

    def refund_payment(
        self,
        transaction_id: str,
        amount: Decimal
    ) -> Dict[str, Any]:
        """
        Simulate refunding.
        """
        return {
            "success": True,
            "refund_id": f"REF{uuid.uuid4().hex[:8].upper()}",
            "amount": amount
        }


class RazorpayPaymentService(PaymentService):
    def process_payment(
        self,
        order_id: uuid.UUID,
        amount: Decimal,
        payment_method: str,
        success: bool = True
    ) -> Dict[str, Any]:
        raise NotImplementedError("Razorpay integration is planned for a future release.")

    def refund_payment(
        self,
        transaction_id: str,
        amount: Decimal
    ) -> Dict[str, Any]:
        raise NotImplementedError("Razorpay integration is planned for a future release.")


class CashfreePaymentService(PaymentService):
    def process_payment(
        self,
        order_id: uuid.UUID,
        amount: Decimal,
        payment_method: str,
        success: bool = True
    ) -> Dict[str, Any]:
        raise NotImplementedError("Cashfree integration is planned for a future release.")

    def refund_payment(
        self,
        transaction_id: str,
        amount: Decimal
    ) -> Dict[str, Any]:
        raise NotImplementedError("Cashfree integration is planned for a future release.")


# Factory/Singleton instance getter
def get_payment_service(provider: str = "mock") -> PaymentService:
    if provider.lower() == "razorpay":
        return RazorpayPaymentService()
    elif provider.lower() == "cashfree":
        return CashfreePaymentService()
    return MockPaymentService()

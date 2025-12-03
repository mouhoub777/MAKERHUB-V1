from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional, Dict

@dataclass
class Payment:
    """Modèle Paiement"""
    payment_id: str
    user_id: str
    page_id: str
    stripe_payment_intent_id: str
    amount: float
    currency: str
    status: str  # succeeded, processing, failed
    payment_method: str
    metadata: Dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self):
        """Convertir en dictionnaire pour Firebase"""
        return {
            'paymentId': self.payment_id,
            'userId': self.user_id,
            'pageId': self.page_id,
            'stripePaymentIntentId': self.stripe_payment_intent_id,
            'amount': self.amount,
            'currency': self.currency,
            'status': self.status,
            'paymentMethod': self.payment_method,
            'metadata': self.metadata,
            'createdAt': self.created_at
        }
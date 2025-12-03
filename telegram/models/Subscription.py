from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional, Dict

@dataclass
class Subscription:
    """Modèle Abonnement"""
    user_id: str
    page_id: str
    stripe_subscription_id: str
    stripe_customer_id: str
    status: str  # active, canceled, past_due, trialing
    currency: str
    amount: float
    current_period_end: datetime
    cancel_at_period_end: bool = False
    metadata: Dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: Optional[datetime] = None
    
    def to_dict(self):
        """Convertir en dictionnaire pour Firebase"""
        return {
            'userId': self.user_id,
            'pageId': self.page_id,
            'stripeSubscriptionId': self.stripe_subscription_id,
            'stripeCustomerId': self.stripe_customer_id,
            'status': self.status,
            'currency': self.currency,
            'amount': self.amount,
            'currentPeriodEnd': self.current_period_end,
            'cancelAtPeriodEnd': self.cancel_at_period_end,
            'metadata': self.metadata,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict):
        """Créer depuis dictionnaire Firebase"""
        return cls(
            user_id=data.get('userId'),
            page_id=data.get('pageId'),
            stripe_subscription_id=data.get('stripeSubscriptionId'),
            stripe_customer_id=data.get('stripeCustomerId'),
            status=data.get('status'),
            currency=data.get('currency'),
            amount=data.get('amount'),
            current_period_end=data.get('currentPeriodEnd'),
            cancel_at_period_end=data.get('cancelAtPeriodEnd', False),
            metadata=data.get('metadata', {}),
            created_at=data.get('createdAt'),
            updated_at=data.get('updatedAt')
        )
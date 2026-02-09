import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { X, ShieldCheck, Lock } from 'lucide-react';
import { supabase } from './supabaseClient';

// Bytt ut med din OFFENTLIGE nøkkel fra Stripe (starter på pk_test_...)
const stripePromise = loadStripe('pk_test_51SX2VILJ3owKw6T0rcS8U973a8ncVN5ICpdlIkjOPscgWFyAIBwlqaPdmHXVLN1lVIv1ZncH7QrHrVxfQyJg1uOx00FnUNBjN2');

const CheckoutForm = ({ amount, onSuccess }: any) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin, // Sender dem tilbake til forsiden etter betaling
      },
    });

    if (error) {
      setErrorMessage(error.message ?? "Noe gikk galt");
      setLoading(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex justify-between font-bold text-slate-900 mb-2">
          <span>Total å betale:</span>
          <span>{amount} kr</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Lock size={12} /> Sikker kryptert betaling via Stripe
        </div>
      </div>

      <PaymentElement />
      
      {errorMessage && <div className="text-rose-500 text-sm font-bold">{errorMessage}</div>}
      
      <button 
        disabled={!stripe || loading} 
        className="w-full bg-violet-600 text-white py-4 rounded-xl font-bold hover:bg-violet-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? 'Prosesserer...' : `Betal ${amount} kr`}
      </button>
    </form>
  );
};

export const PaymentModal = ({ plan, onClose }: { plan: string, onClose: () => void }) => {
  const [clientSecret, setClientSecret] = useState('');

  // Priser
  const prices:Record<string, number> = { basic: 199, standard: 499, premium: 999 };
  const amount = prices[plan];

  useEffect(() => {
    // HER ER MAGIEN: Vi må be Supabase om å lage en "PaymentIntent"
    // Dette krever at du har satt opp en Edge Function (Backend).
    // For nå lager vi en tom funksjon så du ser hvor koden skal være.
    
    async function fetchClientSecret() {
      // 1. Kalle din Supabase funksjon (som vi må lage senere)
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: { plan, amount }
      });
      
      if (data && data.clientSecret) {
         setClientSecret(data.clientSecret);
      }
    }
    
    fetchClientSecret();
  }, [plan]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900"><X /></button>
        
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck />
          </div>
          <h2 className="text-2xl font-black text-slate-900">Oppgrader til {plan}</h2>
          <p className="text-slate-500">Fyll inn kortinformasjon for å starte.</p>
        </div>

        {clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
            <CheckoutForm amount={amount} onSuccess={() => alert("Betaling vellykket!")} />
          </Elements>
        ) : (
          <div className="text-center py-10 text-slate-400 font-bold">
            <p className="animate-pulse">Kobler til Stripe...</p>
            <p className="text-xs font-normal mt-2 text-rose-400">(Krever backend setup)</p>
          </div>
        )}
      </div>
    </div>
  );
};
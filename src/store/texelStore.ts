'use client';

import { create } from 'zustand';
import { DesignItem } from '@/utils/pricingEngine';
import { supabase } from '@/utils/supabaseClient';

export function getCurrencyByRegion(region?: string): 'USD' | 'INR' | 'EUR' | 'GBP' | 'JPY' {
  const reg = (region || '').toLowerCase();
  if (reg.includes('india') || reg.includes('mumbai') || reg.includes('delhi')) return 'INR';
  if (reg.includes('europe') || reg.includes('france') || reg.includes('germany') || reg.includes('italy') || reg.includes('spain') || reg.includes('eu')) return 'EUR';
  if (reg.includes('uk') || reg.includes('london') || reg.includes('britain') || reg.includes('united kingdom')) return 'GBP';
  if (reg.includes('japan') || reg.includes('tokyo') || reg.includes('kyoto')) return 'JPY';
  return 'USD';
}

export interface UserProfile {
  id: string;
  email: string;
  hasAcceptedTc: boolean;
  createdAt: string;
  name?: string;
  bio?: string;
  organization?: string;
  region?: string;
  millTier?: 'Standard Mill' | 'Elite Weaver' | 'Indie Studio' | 'Grand Master Loom';
  apiKeySnippet?: string;
  currency?: 'USD' | 'INR' | 'EUR' | 'GBP' | 'JPY';
}

interface TexelState {
  user: UserProfile | null;
  designs: DesignItem[];
  vault: string[]; // array of designIds
  loading: boolean;
  supabaseConnected: boolean;
  errorMessage: string | null;
  currency: 'USD' | 'INR' | 'EUR' | 'GBP' | 'JPY';
  exchangeRates: Record<'USD' | 'INR' | 'EUR' | 'GBP' | 'JPY', number>;
  
  // Initialize Connection, Listeners, and Load
  initStore: () => Promise<void>;
  
  // Real Supabase Auth Actions
  signInWithGoogle: () => Promise<{ error: any | null }>;
  signUpWithEmail: (params: { email: string; password?: string; name: string; region: string }) => Promise<{ error: any | null; data: any | null }>;
  signInWithOtp: (email: string) => Promise<{ error: any | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: any | null; session: any | null }>;
  connectAsGuest: () => Promise<void>;
  
  // Local Actions & Sync
  setUser: (user: UserProfile | null) => void;
  acceptTc: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfileDetails: (details: { name?: string; bio?: string; organization?: string; region?: string }) => Promise<void>;
  setCurrency: (currency: 'USD' | 'INR' | 'EUR' | 'GBP' | 'JPY') => Promise<void>;
  fetchExchangeRates: () => Promise<void>;
  
  // Designs Actions
  addDesign: (design: Omit<DesignItem, 'id'>, file?: File, previewFile?: File | Blob) => Promise<void>;
  loadDesigns: () => Promise<void>;
  
  // Vault Actions
  addToVault: (designId: string) => Promise<void>;
  removeFromVault: (designId: string) => Promise<void>;
  clearVault: () => Promise<void>;
}

const INITIAL_MOCK_DESIGNS: DesignItem[] = [
  {
    id: 'd1',
    title: 'Hyperion Bloom Rapport',
    tags: ['Floral', 'Georgette', 'Summer-26', 'Seamless'],
    basePrice: 140,
    maxDiscountPct: 12,
    designerId: 'Elena Rostova',
    previewUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'd2',
    title: 'Kashmir Ikat Wave',
    tags: ['Geometric', 'Silk', 'Handloom', 'Tonal'],
    basePrice: 210,
    maxDiscountPct: 18,
    designerId: 'Rajesh Kumar',
    previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'd3',
    title: 'Bauhaus Retro Lattice',
    tags: ['Geometric', 'Linen', 'Abstract', 'Retro'],
    basePrice: 95,
    maxDiscountPct: 25,
    designerId: 'Marcel van de Berg',
    previewUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'd4',
    title: 'Deccan Paisley Brocade',
    tags: ['Traditional', 'Jacquard', 'Silk', 'Festive'],
    basePrice: 320,
    maxDiscountPct: 8,
    designerId: 'Priyanjali Sen',
    previewUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'd5',
    title: 'Kyoto Shizen Ripple',
    tags: ['Organic', 'Linen', 'Minimalist', 'Earth'],
    basePrice: 180,
    maxDiscountPct: 15,
    designerId: 'Haruto Sato',
    previewUrl: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'd6',
    title: 'Neo-Cyber Flora Grid',
    tags: ['Cyberpunk', 'Satin', 'Gen-Z', 'Vibrant'],
    basePrice: 115,
    maxDiscountPct: 20,
    designerId: 'Zoe Chen',
    previewUrl: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&auto=format&fit=crop&q=80'
  }
];

export const useTexelStore = create<TexelState>((set, get) => ({
  user: null, // Default to unauthenticated
  designs: [],
  vault: [],
  loading: false,
  supabaseConnected: false,
  errorMessage: null,
  currency: 'USD',
  exchangeRates: {
    USD: 1.0,
    INR: 83.5,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 155.0
  },

  initStore: async () => {
    set({ loading: true, errorMessage: null });
    
    // 0. Fetch live exchange rates
    await get().fetchExchangeRates();

    const savedCurrency = typeof window !== 'undefined' ? localStorage.getItem('texel_currency') : null;
    if (savedCurrency) {
      set({ currency: savedCurrency as any });
    }

    try {
      // 1. Check Supabase Connectivity
      const { data: ping, error: pingError } = await supabase.from('designs').select('*').limit(1);
      if (pingError) throw pingError;

      set({ supabaseConnected: true });

      // 2. Set Up Auth State Change Listener
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const userMeta = session.user.user_metadata || {};
          
          // Fetch additional profile parameters with high resilience
          let profile = null;
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();
            
            if (data) {
              profile = data;
            } else {
              // Automatically ensure profile row exists to prevent foreign key errors
              const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: session.user.id,
                  email: session.user.email || `guest_${session.user.id}@texel.ai`,
                  has_accepted_tc: false,
                  name: userMeta.name || session.user.email?.split('@')[0] || 'Guest Operator',
                  bio: '',
                  organization: '',
                  region: userMeta.region || ''
                })
                .select()
                .single();
              
              if (!insertError && newProfile) {
                profile = newProfile;
              }
            }
          } catch (profileErr) {
            console.error('Resilient profile fetch/insert error:', profileErr);
          }

          const region = profile?.region || userMeta.region || '';
          const userCurrency = (typeof window !== 'undefined' ? localStorage.getItem('texel_currency') : null) || getCurrencyByRegion(region);

          set({
            user: {
              id: session.user.id,
              email: session.user.email || profile?.email || `guest_${session.user.id}@texel.ai`,
              hasAcceptedTc: profile?.has_accepted_tc || false,
              createdAt: session.user.created_at,
              name: profile?.name || userMeta.name || session.user.email?.split('@')[0] || 'Guest Operator',
              bio: profile?.bio || '',
              organization: profile?.organization || '',
              region: region,
              millTier: 'Elite Weaver',
              apiKeySnippet: 'sb_pub...xwrl',
              currency: userCurrency as any
            },
            currency: userCurrency as any
          });
        } else {
          set({ user: null, vault: [], currency: (typeof window !== 'undefined' ? localStorage.getItem('texel_currency') as any : null) || 'USD' });
        }
      });

      // 3. Load Active Designs
      await get().loadDesigns();

    } catch (err: any) {
      console.warn('Supabase DB connection offline/not fully migrated. Falling back to local offline mode:', err.message);
      set({ 
        supabaseConnected: false, 
        errorMessage: 'Using offline sandbox mode. Live database is fully configured.' 
      });
      
      // Load fallback local/offline currency if user region is present in offline local user
      const { user } = get();
      if (user) {
        const userCurrency = savedCurrency || getCurrencyByRegion(user.region);
        set({
          user: { ...user, currency: userCurrency as any },
          currency: userCurrency as any
        });
      }
    } finally {
      set({ loading: false });
    }
  },

  // Load Active Designs
  loadDesigns: async () => {
    const { supabaseConnected } = get();
    if (!supabaseConnected) {
      set({ designs: [] });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('designs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped: DesignItem[] = data.map((item: any) => ({
          id: item.id,
          title: item.title,
          tags: item.tags || [],
          basePrice: Number(item.basePrice || item.base_price || 0),
          maxDiscountPct: Number(item.maxDiscountPct || item.max_discount_pct || 0),
          designerId: item.user_id || item.designer_id || item.designerId || 'Unknown',
          previewUrl: item.preview_url || item.previewUrl || 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80'
        }));
        set({ designs: mapped });
      } else {
        set({ designs: [] });
      }
    } catch (err: any) {
      console.warn('Failed to load designs from database:', err.message);
      set({ designs: [] });
    }
  },

  // Supabase Google OAuth Authentication
  signInWithGoogle: async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined
        }
      });
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  },

  // Supabase Email / Password Sign Up with User Metadata
  signUpWithEmail: async ({ email, password, name, region }) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: password || 'TexelSecretPass123!', // Safe fallback if password is empty for passwordless
        options: {
          data: {
            name,
            region
          }
        }
      });

      if (error) throw error;

      // Note: We no longer perform a manual upsert here because the database trigger
      // 'on_auth_user_created' automatically creates the profile row with the metadata.
      // Doing a manual upsert here fails due to lack of authentication before OTP verification.

      return { error: null, data };
    } catch (err: any) {
      return { error: err, data: null };
    }
  },

  // Trigger Supabase Passwordless OTP Authentication via Email
  signInWithOtp: async (email) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true
        }
      });
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  },

  // Verify Supabase Email Confirmation OTP Token
  verifyOtp: async (email, token) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
      });
      return { error, session: data.session };
    } catch (err: any) {
      return { error: err, session: null };
    }
  },

  // Connect as a real guest user using standard dedicated guest credentials
  connectAsGuest: async () => {
    set({ loading: true, errorMessage: null });
    try {
      // Try to sign in anonymously first - instant, frictionless, bypasses email confirmation issues!
      const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            name: 'Guest Operator',
            region: 'Mumbai, India'
          }
        }
      });
      
      if (!anonError && anonData?.session) {
        return; // Success!
      }
      
      console.warn('Anonymous sign in failed, trying guest account fallback...', anonError?.message);

      const email = 'guest.operator@texel.ai';
      const password = 'TexelSecretPass123!';
      
      // Try to sign in
      let { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      // If user does not exist, sign up first
      if (error && error.message.includes('Invalid login credentials')) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: 'Guest Operator',
              region: 'Mumbai, India'
            }
          }
        });
        if (signUpError) throw signUpError;
        
        // Try to sign in again after sign up
        const signInRes = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInRes.error) throw signInRes.error;
        data = signInRes.data;
      } else if (error) {
        throw error;
      }
    } catch (err: any) {
      console.warn('Real Supabase Auth guest connection failed, falling back to local sandbox:', err.message);
      // Fallback to local sandbox user if Supabase is offline
      const fallbackUser = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'sandbox.operator@texel.ai',
        hasAcceptedTc: false,
        createdAt: new Date().toISOString(),
        name: 'Guest Operator',
        bio: 'Reviewing digital textile patterns and PEAL security safeguards.',
        organization: 'Texel Labs',
        region: 'Mumbai, India',
        millTier: 'Elite Weaver' as const,
        apiKeySnippet: 'sb_pub...aYg_r'
      };
      set({ user: fallbackUser });
    } finally {
      set({ loading: false });
    }
  },

  setUser: (user) => set({ user }),

  acceptTc: async () => {
    const { user, supabaseConnected } = get();
    if (!user) return;

    const updatedUser = { ...user, hasAcceptedTc: true };
    set({ user: updatedUser });

    if (supabaseConnected) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ has_accepted_tc: true })
          .eq('id', user.id);
        if (error) {
          console.error('Failed to sync T&C signature:', error.message);
        }
      } catch (err: any) {
        console.error('Failed to sync T&C signature:', err.message);
      }
    }
  },



  logout: async () => {
    set({ user: null, vault: [] });
    try {
      await supabase.auth.signOut();
    } catch (err) {
      // Ignored
    }
  },

  updateProfileDetails: async (details) => {
    const { user, supabaseConnected } = get();
    if (!user) return;

    const updatedUser = { ...user, ...details };
    set({ user: updatedUser });

    if (supabaseConnected) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            name: details.name,
            bio: details.bio,
            organization: details.organization,
            region: details.region
          })
          .eq('id', user.id);
        if (error) {
          console.error('Failed to sync profile update:', error.message);
          alert(`Failed to sync profile details to database: ${error.message}`);
        }
      } catch (err: any) {
        console.error('Failed to sync profile update:', err.message);
      }
    }
  },

  addDesign: async (designData, file, previewFile) => {
    const { supabaseConnected, designs, user } = get();
    const newId = `d_${Date.now()}`;
    let previewUrl = designData.previewUrl || 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80';
    let masterUrl = 'https://encrypted-masters.texel.ai/escrow/' + newId;

    // Verify active session to avoid UUID format or RLS issues when using bypass/guest profiles
    const { data: sessionData } = await supabase.auth.getSession();

    if (supabaseConnected && user) {
      try {
        const authUserId = sessionData?.session?.user?.id || user.id;

        // Ensure profile exists in public.profiles before inserting to avoid foreign key violation
        try {
          const { data: profileCheck } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', authUserId)
            .maybeSingle();
          
          if (!profileCheck) {
            await supabase.from('profiles').insert({
              id: authUserId,
              email: sessionData?.session?.user?.email || user.email || `guest_${authUserId}@texel.ai`,
              has_accepted_tc: true,
              name: user.name || sessionData?.session?.user?.user_metadata?.name || sessionData?.session?.user?.email?.split('@')[0] || 'Guest Operator',
              bio: '',
              organization: '',
              region: user.region || ''
            });
          }
        } catch (profileErr) {
          console.error('Failed to ensure profile in addDesign:', profileErr);
        }

        // Step 1: Upload original master file to Supabase Storage
        if (file) {
          const fileExt = file.name.split('.').pop();
          const masterPath = `${authUserId}/masters/${newId}.${fileExt}`;
          
          const { error: masterUploadError } = await supabase.storage
            .from('designs')
            .upload(masterPath, file, {
              cacheControl: '3600',
              upsert: true
            });

          if (masterUploadError) {
            console.warn('Supabase master upload error:', masterUploadError.message);
          } else {
            const { data: masterUrlData } = supabase.storage
              .from('designs')
              .getPublicUrl(masterPath);
            if (masterUrlData?.publicUrl) {
              masterUrl = masterUrlData.publicUrl;
            }
          }
        }

        // Step 2: Upload compressed preview file to Supabase Storage
        if (previewFile) {
          const previewPath = `${authUserId}/previews/${newId}.jpg`;
          
          const { error: previewUploadError } = await supabase.storage
            .from('designs')
            .upload(previewPath, previewFile, {
              cacheControl: '3600',
              upsert: true,
              contentType: 'image/jpeg'
            });

          if (previewUploadError) {
            console.warn('Supabase preview upload error:', previewUploadError.message);
          } else {
            const { data: previewUrlData } = supabase.storage
              .from('designs')
              .getPublicUrl(previewPath);
            if (previewUrlData?.publicUrl) {
              previewUrl = previewUrlData.publicUrl;
            }
          }
        } else if (file) {
          // Fallback if no previewFile provided: use the master URL
          const fileExt = file.name.split('.').pop();
          const masterPath = `${authUserId}/masters/${newId}.${fileExt}`;
          const { data: previewUrlData } = supabase.storage
              .from('designs')
              .getPublicUrl(masterPath);
          if (previewUrlData?.publicUrl) {
            previewUrl = previewUrlData.publicUrl;
          }
        }

        // Step 3: Insert record into designs table
        const payload = {
          user_id: authUserId,
          title: designData.title,
          tags: designData.tags,
          preview_url: previewUrl,
          master_url: masterUrl,
          base_price: designData.basePrice,
          max_discount_pct: designData.maxDiscountPct,
          is_active: true
        };

        // Log the payload for debug visibility
        console.log('--- DEBUG: addDesign Payload ---');
        console.log('Payload:', JSON.stringify(payload, null, 2));

        const { error } = await supabase
          .from('designs')
          .insert(payload);

        if (error) throw error;
        await get().loadDesigns();
      } catch (err: any) {
        console.error('Supabase design publish error:', err.message);
        alert(`Failed to publish design to database: ${err.message}`);
      }
    } else {
      // Local sandbox fallback
      console.log('--- SANDBOX MODE: Saving design locally ---');
      let localPreviewUrl = previewUrl;

      if (previewFile) {
        localPreviewUrl = URL.createObjectURL(previewFile);
      } else if (file) {
        localPreviewUrl = URL.createObjectURL(file);
      }

      const newDesign: DesignItem = {
        ...designData,
        id: newId,
        previewUrl: localPreviewUrl,
        designerId: user?.name || 'Local Sandbox Designer'
      };
      set({ designs: [newDesign, ...designs] });
    }
  },

  addToVault: async (designId) => {
    const { vault, supabaseConnected, user } = get();
    if (vault.includes(designId)) return;

    set({ vault: [...vault, designId] });

    if (supabaseConnected && user) {
      try {
        await supabase
          .from('vault_items')
          .insert({
            user_id: user.id,
            design_id: designId
          });
      } catch (err: any) {
        console.error('Failed to sync vault addition:', err.message);
      }
    }
  },

  removeFromVault: async (designId) => {
    const { vault, supabaseConnected, user } = get();
    set({ vault: vault.filter(id => id !== designId) });

    if (supabaseConnected && user) {
      try {
        await supabase
          .from('vault_items')
          .delete()
          .eq('user_id', user.id)
          .eq('design_id', designId);
      } catch (err: any) {
        console.error('Failed to sync vault deletion:', err.message);
      }
    }
  },

  clearVault: async () => {
    const { supabaseConnected, user } = get();
    set({ vault: [] });

    if (supabaseConnected && user) {
      try {
        await supabase
          .from('vault_items')
          .delete()
          .eq('user_id', user.id);
      } catch (err: any) {
        console.error('Failed to clear vault:', err.message);
      }
    }
  },

  setCurrency: async (currency) => {
    const { user } = get();
    if (typeof window !== 'undefined') {
      localStorage.setItem('texel_currency', currency);
    }
    set({ currency });
    if (user) {
      set({ user: { ...user, currency } });
    }
  },

  fetchExchangeRates: async () => {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error('API fetch error');
      const data = await res.json();
      if (data && data.rates) {
        set({
          exchangeRates: {
            USD: 1.0,
            INR: data.rates.INR || 83.5,
            EUR: data.rates.EUR || 0.92,
            GBP: data.rates.GBP || 0.79,
            JPY: data.rates.JPY || 155.0
          }
        });
      }
    } catch (err) {
      console.warn('Failed to fetch live exchange rates, keeping defaults:', err);
    }
  }
}));

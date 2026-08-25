// src/hooks/usePromotionQueries.js

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { promotionAPI } from '../services/api';

export const promotionKeys = {
    all: ['promotions'],
    lists: () => [...promotionKeys.all, 'list'],
    list: (filters) => [...promotionKeys.lists(), { filters }],
    details: () => [...promotionKeys.all, 'detail'],
    detail: (id) => [...promotionKeys.details(), id],
    stats: () => [...promotionKeys.all, 'stats'],
    active: () => [...promotionKeys.all, 'active'],
    redemptions: (id) => ['promotion-redemptions', id],
    analytics: (id) => ['promotion-analytics', id],
};

// ==================== QUERIES ====================

export const usePromotions = (filters = {}) => {
    return useQuery({
        queryKey: promotionKeys.list(filters),
        queryFn: () => promotionAPI.getPromotions(filters),
        select: (response) => response?.data?.data || { data: [], total: 0 },
        staleTime: 2 * 60 * 1000,
        keepPreviousData: true,
    });
};

export const usePromotion = (id) => {
    return useQuery({
        queryKey: promotionKeys.detail(id),
        queryFn: () => promotionAPI.getPromotion(id),
        select: (response) => response?.data?.data || null,
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
};

export const usePromotionStats = () => {
    return useQuery({
        queryKey: promotionKeys.stats(),
        queryFn: () => promotionAPI.getStats(),
        select: (response) => response?.data?.data || {},
        staleTime: 2 * 60 * 1000,
    });
};

export const useActivePromotions = (params = {}) => {
    return useQuery({
        queryKey: promotionKeys.active(),
        queryFn: () => promotionAPI.getActivePromotions(params),
        select: (response) => response?.data?.data || [],
        staleTime: 1 * 60 * 1000,
    });
};

export const usePromotionRedemptions = (id, params = {}) => {
    return useQuery({
        queryKey: promotionKeys.redemptions(id),
        queryFn: () => promotionAPI.getRedemptions(id, params),
        select: (response) => response?.data?.data || { data: [], total: 0 },
        enabled: !!id,
        staleTime: 2 * 60 * 1000,
    });
};

export const usePromotionAnalytics = (id) => {
    return useQuery({
        queryKey: promotionKeys.analytics(id),
        queryFn: () => promotionAPI.getAnalytics(id),
        select: (response) => response?.data?.data || {},
        enabled: !!id,
        staleTime: 2 * 60 * 1000,
    });
};

// ==================== MUTATIONS ====================

export const useCreatePromotion = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data) => promotionAPI.createPromotion(data),
        onSuccess: () => {
            message.success('Promotion created successfully');
            queryClient.invalidateQueries({ queryKey: promotionKeys.all });
            queryClient.invalidateQueries({ queryKey: promotionKeys.stats() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to create promotion');
        },
    });
};

export const useUpdatePromotion = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }) => promotionAPI.updatePromotion({ id, data }),
        onSuccess: (_, variables) => {
            message.success('Promotion updated successfully');
            queryClient.invalidateQueries({ queryKey: promotionKeys.all });
            queryClient.invalidateQueries({ queryKey: promotionKeys.detail(variables.id) });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to update promotion');
        },
    });
};

export const useDeletePromotion = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id) => promotionAPI.deletePromotion(id),
        onSuccess: () => {
            message.success('Promotion deleted successfully');
            queryClient.invalidateQueries({ queryKey: promotionKeys.all });
            queryClient.invalidateQueries({ queryKey: promotionKeys.stats() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to delete promotion');
        },
    });
};

export const useTogglePromotionActive = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id) => promotionAPI.toggleActive(id),
        onSuccess: (response) => {
            const isActive = response?.data?.data?.is_active;
            message.success(`Promotion ${isActive ? 'activated' : 'deactivated'} successfully`);
            queryClient.invalidateQueries({ queryKey: promotionKeys.all });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to toggle promotion');
        },
    });
};

export const useDuplicatePromotion = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id) => promotionAPI.duplicate(id),
        onSuccess: () => {
            message.success('Promotion duplicated successfully');
            queryClient.invalidateQueries({ queryKey: promotionKeys.all });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to duplicate promotion');
        },
    });
};

export const useValidatePromoCode = () => {
    return useMutation({
        mutationFn: (data) => promotionAPI.validateCode(data),
        onError: (error) => {
            // Don't show message for validation errors - let the component handle it
            throw error;
        },
    });
};

export const useRedeemPromoCode = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data) => promotionAPI.redeemCode(data),
        onSuccess: (_, variables) => {
            message.success('Promo code applied successfully');
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            queryClient.invalidateQueries({ queryKey: ['quotations'] });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to apply promo code');
        },
    });
};
// src/hooks/useMenuQueries.jsx

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import {
  categoryAPI,
  ingredientAPI,
  menuAPI,
  packageAPI,
  promotionAPI,
  recipeAPI,
  statisticsAPI,
} from '../services/api';
import dayjs from 'dayjs';

// ============================================================
// QUERY KEYS
// ============================================================
export const menuKeys = {
  root: ['menu-management'],
  menus: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value !== undefined && value !== null)
    );
    return ['menu-management', 'menus', cleanParams];
  },
  menu: (id) => ['menu-management', 'menu', id],
  categories: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value !== undefined && value !== null)
    );
    return ['menu-management', 'categories', cleanParams];
  },
  packages: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value !== undefined && value !== null)
    );
    return ['menu-management', 'packages', cleanParams];
  },
  package: (id) => ['menu-management', 'package', id],
  promotions: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value !== undefined && value !== null)
    );
    return ['menu-management', 'promotions', cleanParams];
  },
  promotion: (id) => ['menu-management', 'promotion', id],
  ingredients: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value !== undefined && value !== null)
    );
    return ['menu-management', 'ingredients', cleanParams];
  },
  recipes: ['menu-management', 'recipes'],
  recipe: (id) => ['menu-management', 'recipe', id],
  statistics: ['menu-management', 'statistics'],
};

// ============================================================
// PROMOTION KEYS
// ============================================================
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

// ============================================================
// HELPERS
// ============================================================
const asArray = (value) => (Array.isArray(value) ? value : []);

const asBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 1 || value === '1' || value === 'true';
};

const payloadOf = (response) => response?.data?.data ?? response?.data ?? null;

// ============================================================
// IMAGE URL HELPER - FIXED
// ============================================================
const getFullImageUrl = (imagePath) => {
  // If no image, return null
  if (!imagePath) {
    return null;
  }

  // Inline SVG/data placeholders are already complete image sources
  if (typeof imagePath === 'string' && imagePath.startsWith('data:image/')) {
    return imagePath;
  }

  // If it's already a full URL, return it
  if (typeof imagePath === 'string' && (imagePath.startsWith('http://') || imagePath.startsWith('https://'))) {
    return imagePath;
  }

  // Get the base URL from environment
  const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
  const cleanBase = baseUrl.replace(/\/api\/v1.*$/, '').replace(/\/+$/, '');

  // Clean the path
  let cleanPath = imagePath;
  if (typeof cleanPath === 'string') {
    // Remove leading slashes
    cleanPath = cleanPath.replace(/^\/+/, '');
    
    // Remove 'storage/' prefix if present
    if (cleanPath.startsWith('storage/')) {
      cleanPath = cleanPath.substring(8);
    }
  }

  // Return the full URL
  return `${cleanBase}/storage/${cleanPath}`;
};

// ============================================================
// RESPONSE NORMALIZERS WITH IMAGE FIX
// ============================================================
const paginated = (response, mapper) => {
  const payload = payloadOf(response);

  if (Array.isArray(payload)) {
    return {
      data: payload.map(mapper),
      total: payload.length,
      current_page: 1,
      last_page: 1,
      per_page: payload.length || 15,
    };
  }

  if (payload && Array.isArray(payload.data)) {
    const mappedData = payload.data.map(mapper);
    return {
      ...payload,
      data: mappedData,
      total: Number(payload.total ?? payload.data.length),
      current_page: Number(payload.current_page ?? 1),
      last_page: Number(payload.last_page ?? 1),
      per_page: Number(payload.per_page ?? 15),
    };
  }

  return { data: [], total: 0, current_page: 1, last_page: 1, per_page: 15 };
};

const list = (response, mapper) => {
  const result = paginated(response, mapper);
  return result.data;
};

export const errorMessage = (error, fallback = 'Request failed. Please try again.') => {
  const errors = error?.response?.data?.errors;
  const firstValidationMessage = errors
    ? Object.values(errors).flat().find(Boolean)
    : null;

  return error?.response?.data?.message
    || firstValidationMessage
    || error?.message
    || fallback;
};

// ============================================================
// RECIPE INGREDIENT MAPPER
// ============================================================
const mapRecipeIngredient = (row = {}) => ({
  id: row.recipe_ingredient_id ?? row.id,
  recipe_ingredient_id: row.recipe_ingredient_id ?? row.id,
  ingredient_id: row.ingredient_id,
  quantity_per_pax: Number(row.quantity_per_pax ?? 0),
  unit: row.unit || row.ingredient?.unit || 'kg',
  ingredient: row.ingredient || null,
  name: row.ingredient?.name || '',
  unit_cost: Number(row.ingredient?.unit_cost ?? 0),
});

// ============================================================
// MENU ITEM MAPPER - FIXED IMAGE HANDLING
// ============================================================
export const mapMenuItem = (item = {}) => {
  // Get the image URL and ensure it's a full URL
  const rawImage = item.image_url ?? item.image ?? null;
  const imageUrl = getFullImageUrl(rawImage);

  return {
    ...item,
    id: item.menu_item_id ?? item.id,
    menu_item_id: item.menu_item_id ?? item.id,
    category_id: item.category_id,
    category: item.category?.name ?? item.category_name ?? 'Uncategorized',
    category_record: item.category ?? null,
    price: Number(item.price ?? 0),
    cost_to_make: Number(item.cost_to_make ?? 0),
    prep_time_minutes: Number(item.prep_time_minutes ?? 0),
    serving_size: Number(item.serving_size ?? 1),
    image: imageUrl,
    image_url: imageUrl,
    is_available: asBoolean(item.is_available, true),
    is_popular: asBoolean(item.is_popular),
    is_vegetarian: asBoolean(item.is_vegetarian),
    is_vegan: asBoolean(item.is_vegan),
    is_gluten_free: asBoolean(item.is_gluten_free),
    is_halal: asBoolean(item.is_halal),
    recipe_ingredients: asArray(item.recipe_ingredients ?? item.recipeIngredients)
      .map(mapRecipeIngredient),
  };
};

// ============================================================
// CATEGORY MAPPER
// ============================================================
export const mapCategory = (category = {}) => ({
  ...category,
  id: category.category_id ?? category.id,
  category_id: category.category_id ?? category.id,
  display_order: Number(category.display_order ?? category.sort_order ?? 0),
  is_active: asBoolean(category.is_active, true),
  menu_items_count: Number(category.menu_items_count ?? 0),
});

// ============================================================
// PACKAGE ITEM MAPPER - FIXED IMAGE HANDLING
// ============================================================
const mapPackageItem = (row = {}) => {
  const menuItem = row.menu_item ?? row.menuItem ?? row;
  const rawImage = menuItem.image_url ?? menuItem.image ?? null;
  const imageUrl = getFullImageUrl(rawImage);

  return {
    ...row,
    id: menuItem.menu_item_id ?? menuItem.id,
    menu_item_id: menuItem.menu_item_id ?? menuItem.id,
    name: menuItem.name ?? '',
    price: Number(menuItem.price ?? 0),
    image: imageUrl,
    image_url: imageUrl,
    quantity_per_pax: Number(row.quantity_per_pax ?? row.quantity ?? 1),
    quantity: Number(row.quantity_per_pax ?? row.quantity ?? 1),
    is_optional: asBoolean(row.is_optional),
    is_replaceable: asBoolean(row.is_replaceable),
    additional_cost: Number(row.additional_cost ?? 0),
    menu_item: menuItem,
  };
};

// ============================================================
// PACKAGE MAPPER - FIXED IMAGE HANDLING
// ============================================================
export const mapPackage = (pkg = {}) => {
  const rawImage = pkg.image_url ?? pkg.image ?? null;
  const imageUrl = getFullImageUrl(rawImage);
  
  const items = asArray(pkg.items ?? pkg.menu_items ?? pkg.menuItems).map(mapPackageItem);
  const menuItems = asArray(pkg.menu_items ?? pkg.items ?? []).map(mapPackageItem);

  return {
    ...pkg,
    id: pkg.package_id ?? pkg.id,
    package_id: pkg.package_id ?? pkg.id,
    base_price_per_pax: Number(pkg.base_price_per_pax ?? 0),
    price_per_additional_pax: Number(pkg.price_per_additional_pax ?? 0),
    min_pax: Number(pkg.min_pax ?? 1),
    max_pax: Number(pkg.max_pax ?? 1),
    default_duration_hours: Number(pkg.default_duration_hours ?? 4),
    sort_order: Number(pkg.sort_order ?? 0),
    is_active: asBoolean(pkg.is_active, true),
    is_featured: asBoolean(pkg.is_featured),
    inclusions: asArray(pkg.inclusions),
    exclusions: asArray(pkg.exclusions),
    items_count: Number(pkg.items_count ?? pkg.menu_items?.length ?? 0),
    image: imageUrl,
    image_url: imageUrl,
    items,
    menu_items: menuItems,
  };
};

// ============================================================
// PROMOTION MAPPER
// ============================================================
export const mapPromotion = (promotion = {}) => ({
  ...promotion,
  id: promotion.promotion_id ?? promotion.id,
  promotion_id: promotion.promotion_id ?? promotion.id,
  discount_value: Number(promotion.discount_value ?? 0),
  discounted_price: promotion.discounted_price ? Number(promotion.discounted_price) : null,
  min_booking_amount: promotion.min_booking_amount ? Number(promotion.min_booking_amount) : null,
  max_redemptions: promotion.max_redemptions ? Number(promotion.max_redemptions) : null,
  redemption_count: Number(promotion.redemption_count ?? 0),
  per_customer_limit: promotion.per_customer_limit ? Number(promotion.per_customer_limit) : null,
  days_before_event: promotion.days_before_event ? Number(promotion.days_before_event) : null,
  sort_order: Number(promotion.sort_order ?? 0),
  is_active: asBoolean(promotion.is_active, true),
  is_featured: asBoolean(promotion.is_featured),
  is_automatic: asBoolean(promotion.is_automatic),
  allow_stacking: asBoolean(promotion.allow_stacking),
  applicable_menu_item_ids: asArray(promotion.applicable_menu_item_ids),
  applicable_package_ids: asArray(promotion.applicable_package_ids),
  applicable_event_type_ids: asArray(promotion.applicable_event_type_ids),
  applicable_days_of_week: asArray(promotion.applicable_days_of_week),
  free_addons: asArray(promotion.free_addons),
  available_dates: asArray(promotion.available_dates),
  status: promotion.status || 'disabled',
  is_expired: promotion.is_expired || false,
  usage_percentage: promotion.usage_percentage || 0,
  days_until_expiry: promotion.days_until_expiry ?? null,
  start_date: promotion.start_date ? dayjs(promotion.start_date).format('YYYY-MM-DD') : null,
  end_date: promotion.end_date ? dayjs(promotion.end_date).format('YYYY-MM-DD') : null,
});

// ============================================================
// INGREDIENT MAPPER
// ============================================================
export const mapIngredient = (ingredient = {}) => ({
  ...ingredient,
  id: ingredient.ingredient_id ?? ingredient.id,
  ingredient_id: ingredient.ingredient_id ?? ingredient.id,
  unit_cost: Number(ingredient.unit_cost ?? 0),
  is_active: asBoolean(ingredient.is_active, true),
});

// ============================================================
// MUTATION HELPER
// ============================================================
const invalidateMenuModule = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: menuKeys.root });
};

const useMutationWithMessage = ({ mutationFn, successText, onSuccess }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (response, variables) => {
      message.success(response?.data?.message || response?.message || successText);
      invalidateMenuModule(queryClient);
      onSuccess?.(response, variables, queryClient);
    },
    onError: (error) => message.error(errorMessage(error)),
  });
};

// ============================================================
// CACHE CONFIGURATION
// ============================================================
const queryOptions = {
  staleTime: Infinity,
  gcTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchInterval: false,
  keepPreviousData: true,
  retry: 1,
  retryDelay: 1000,
  initialData: undefined,
};

// ============================================================
// MENU ITEMS QUERIES
// ============================================================
export const useMenuItems = (params = {}) => useQuery({
  queryKey: menuKeys.menus(params),
  queryFn: async () => paginated(await menuAPI.getMenuItems(params), mapMenuItem),
  ...queryOptions,
  enabled: true,
});

export const useMenuItem = (id) => useQuery({
  queryKey: menuKeys.menu(id),
  queryFn: async () => mapMenuItem(payloadOf(await menuAPI.getMenuItem(id))),
  enabled: Boolean(id),
  ...queryOptions,
});

export const useCreateMenuItem = () => useMutationWithMessage({
  mutationFn: async (data) => (await menuAPI.createMenuItem(data)).data,
  successText: 'Menu item created successfully',
});

export const useUpdateMenuItem = () => useMutationWithMessage({
  mutationFn: async ({ id, data }) => (await menuAPI.updateMenuItem({ id, data })).data,
  successText: 'Menu item updated successfully',
});

export const useDeleteMenuItem = () => useMutationWithMessage({
  mutationFn: async (id) => (await menuAPI.deleteMenuItem(id)).data,
  successText: 'Menu item deleted successfully',
});

export const useToggleMenuItemAvailability = () => useMutationWithMessage({
  mutationFn: async (id) => (await menuAPI.toggleAvailability(id)).data,
  successText: 'Availability updated successfully',
});

export const useToggleMenuItemFeatured = () => useMutationWithMessage({
  mutationFn: async (id) => (await menuAPI.toggleFeatured(id)).data,
  successText: 'Featured status updated successfully',
});

// ============================================================
// CATEGORIES QUERIES
// ============================================================
export const useCategories = (params = {}) => useQuery({
  queryKey: menuKeys.categories(params),
  queryFn: async () => paginated(await categoryAPI.getCategories(params), mapCategory),
  ...queryOptions,
});

export const useCreateCategory = () => useMutationWithMessage({
  mutationFn: async (data) => (await categoryAPI.createCategory(data)).data,
  successText: 'Category created successfully',
});

export const useUpdateCategory = () => useMutationWithMessage({
  mutationFn: async ({ id, data }) => (await categoryAPI.updateCategory({ id, data })).data,
  successText: 'Category updated successfully',
});

export const useDeleteCategory = () => useMutationWithMessage({
  mutationFn: async (id) => (await categoryAPI.deleteCategory(id)).data,
  successText: 'Category deleted successfully',
});

// ============================================================
// PACKAGES QUERIES
// ============================================================
export const usePackages = (params = {}) => useQuery({
  queryKey: menuKeys.packages(params),
  queryFn: async () => paginated(await packageAPI.getPackages(params), mapPackage),
  ...queryOptions,
});

export const usePackage = (id) => useQuery({
  queryKey: menuKeys.package(id),
  queryFn: async () => mapPackage(payloadOf(await packageAPI.getPackage(id))),
  enabled: Boolean(id),
  ...queryOptions,
});

export const useCreatePackage = () => useMutationWithMessage({
  mutationFn: async (data) => (await packageAPI.createPackage(data)).data,
  successText: 'Package created successfully',
});

export const useUpdatePackage = () => useMutationWithMessage({
  mutationFn: async ({ id, data }) => (await packageAPI.updatePackage({ id, data })).data,
  successText: 'Package updated successfully',
});

export const useDeletePackage = () => useMutationWithMessage({
  mutationFn: async (id) => (await packageAPI.deletePackage(id)).data,
  successText: 'Package deleted successfully',
});

// ============================================================
// PROMOTIONS QUERIES
// ============================================================
export const usePromotions = (params = {}) => useQuery({
  queryKey: promotionKeys.list(params),
  queryFn: async () => {
    const response = await promotionAPI.getPromotions(params);
    return paginated(response, mapPromotion);
  },
  ...queryOptions,
});

export const usePromotion = (id) => useQuery({
  queryKey: promotionKeys.detail(id),
  queryFn: async () => {
    const response = await promotionAPI.getPromotion(id);
    return mapPromotion(payloadOf(response));
  },
  enabled: Boolean(id),
  ...queryOptions,
});

export const usePromotionStats = () => useQuery({
  queryKey: promotionKeys.stats(),
  queryFn: async () => {
    const response = await promotionAPI.getStats();
    return payloadOf(response) || {};
  },
  ...queryOptions,
});

export const useActivePromotions = (params = {}) => useQuery({
  queryKey: promotionKeys.active(),
  queryFn: async () => {
    const response = await promotionAPI.getActivePromotions(params);
    const data = payloadOf(response);
    return Array.isArray(data) ? data.map(mapPromotion) : [];
  },
  ...queryOptions,
});

export const usePromotionRedemptions = (id, params = {}) => useQuery({
  queryKey: promotionKeys.redemptions(id),
  queryFn: async () => {
    const response = await promotionAPI.getRedemptions(id, params);
    return payloadOf(response) || { data: [], total: 0 };
  },
  enabled: !!id,
  ...queryOptions,
});

export const usePromotionAnalytics = (id, options = {}) => useQuery({
  queryKey: promotionKeys.analytics(id),
  queryFn: async () => {
    const response = await promotionAPI.getAnalytics(id);
    return payloadOf(response) || {};
  },
  enabled: !!id && options.enabled !== false,
  ...queryOptions,
});

// ============================================================
// PROMOTIONS MUTATIONS
// ============================================================
export const useCreatePromotion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data) => {
      const response = await promotionAPI.createPromotion(data);
      return response.data;
    },
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
    mutationFn: async ({ id, data }) => {
      const response = await promotionAPI.updatePromotion({ id, data });
      return response.data;
    },
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
    mutationFn: async (id) => {
      const response = await promotionAPI.deletePromotion(id);
      return response.data;
    },
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
    mutationFn: async (id) => {
      const response = await promotionAPI.toggleActive(id);
      return response.data;
    },
    onSuccess: (response) => {
      const isActive = response?.data?.is_active;
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
    mutationFn: async (id) => {
      const response = await promotionAPI.duplicate(id);
      return response.data;
    },
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
    mutationFn: async (data) => {
      const response = await promotionAPI.validateCode(data);
      return response.data;
    },
    onError: (error) => {
      // Don't show message for validation errors - let the component handle it
      throw error;
    },
  });
};

export const useRedeemPromoCode = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data) => {
      const response = await promotionAPI.redeemCode(data);
      return response.data;
    },
    onSuccess: () => {
      message.success('Promo code applied successfully');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to apply promo code');
    },
  });
};

// ============================================================
// INGREDIENTS QUERIES
// ============================================================
export const useIngredients = (params = {}) => useQuery({
  queryKey: menuKeys.ingredients(params),
  queryFn: async () => paginated(await ingredientAPI.getIngredients(params), mapIngredient),
  ...queryOptions,
});

export const useCreateIngredient = () => useMutationWithMessage({
  mutationFn: async (data) => (await ingredientAPI.createIngredient(data)).data,
  successText: 'Ingredient created successfully',
});

export const useUpdateIngredient = () => useMutationWithMessage({
  mutationFn: async ({ id, data }) => (await ingredientAPI.updateIngredient({ id, data })).data,
  successText: 'Ingredient updated successfully',
});

export const useDeleteIngredient = () => useMutationWithMessage({
  mutationFn: async (id) => (await ingredientAPI.deleteIngredient(id)).data,
  successText: 'Ingredient deleted successfully',
});

// ============================================================
// RECIPES QUERIES
// ============================================================
export const useRecipes = () => useQuery({
  queryKey: menuKeys.recipes,
  queryFn: async () => list(await recipeAPI.getRecipes(), mapMenuItem),
  ...queryOptions,
});

export const useRecipe = (menuItemId) => useQuery({
  queryKey: menuKeys.recipe(menuItemId),
  queryFn: async () => mapMenuItem(payloadOf(await recipeAPI.getRecipe(menuItemId))),
  enabled: Boolean(menuItemId),
  ...queryOptions,
});

export const useSaveRecipe = () => useMutationWithMessage({
  mutationFn: async (data) => (await recipeAPI.saveRecipe(data)).data,
  successText: 'Recipe saved successfully',
});

export const useDeleteRecipe = () => useMutationWithMessage({
  mutationFn: async (id) => (await recipeAPI.deleteRecipe(id)).data,
  successText: 'Recipe deleted successfully',
});

// ============================================================
// STATISTICS
// ============================================================
export const useMenuStatistics = () => useQuery({
  queryKey: menuKeys.statistics,
  queryFn: async () => payloadOf(await statisticsAPI.getMenuStatistics()) || {},
  ...queryOptions,
  retry: false,
});

// ============================================================
// DEFAULT EXPORT
// ============================================================
export default {
  // Keys
  menuKeys,
  promotionKeys,
  
  // Menu Item Hooks
  useMenuItems,
  useMenuItem,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useToggleMenuItemAvailability,
  useToggleMenuItemFeatured,
  
  // Category Hooks
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  
  // Package Hooks
  usePackages,
  usePackage,
  useCreatePackage,
  useUpdatePackage,
  useDeletePackage,
  
  // Promotion Hooks
  usePromotions,
  usePromotion,
  usePromotionStats,
  useActivePromotions,
  usePromotionRedemptions,
  usePromotionAnalytics,
  useCreatePromotion,
  useUpdatePromotion,
  useDeletePromotion,
  useTogglePromotionActive,
  useDuplicatePromotion,
  useValidatePromoCode,
  useRedeemPromoCode,
  
  // Ingredient Hooks
  useIngredients,
  useCreateIngredient,
  useUpdateIngredient,
  useDeleteIngredient,
  
  // Recipe Hooks
  useRecipes,
  useRecipe,
  useSaveRecipe,
  useDeleteRecipe,
  
  // Statistics
  useMenuStatistics,
  
  // Mappers
  mapMenuItem,
  mapCategory,
  mapPackage,
  mapPromotion,
  mapIngredient,
};
<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\AttributeValueResource;
use App\Http\Resources\CategoryAttributeResource;
use App\Models\AttributeValue;
use App\Models\AuditLog;
use App\Models\CategoryAttribute;
use App\Models\ProductCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CategoryAttributeController extends BaseController
{
    // ========== ADMIN: CATEGORY ATTRIBUTES ==========

    public function index(Request $request): JsonResponse
    {
        $query = CategoryAttribute::query()
            ->with(['values' => function ($q) {
                $q->orderBy('sort_order')->orderBy('value');
            }])
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($request->has('is_filterable')) {
            $query->where('is_filterable', $request->boolean('is_filterable'));
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        $attributes = $query->get();

        return $this->success(CategoryAttributeResource::collection($attributes));
    }

    public function show(int $id): JsonResponse
    {
        $attribute = CategoryAttribute::with(['values' => function ($q) {
            $q->orderBy('sort_order')->orderBy('value');
        }])->findOrFail($id);

        return $this->success(new CategoryAttributeResource($attribute));
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'category_id' => 'required|exists:product_categories,id',
            'name' => 'required|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'slug' => 'nullable|string|max:255',
            'unit' => 'nullable|string|max:50',
            'input_type' => 'nullable|in:select,multiselect,text,number',
            'is_filterable' => 'nullable|boolean',
            'is_required' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
            'values' => 'nullable|array',
            'values.*.value' => 'required_with:values|string|max:255',
            'values.*.value_bn' => 'nullable|string|max:255',
            'values.*.sort_order' => 'nullable|integer',
        ]);

        $data = $request->only(['category_id', 'name', 'name_bn', 'slug', 'unit', 'input_type', 'sort_order']);
        $data['input_type'] = $request->input('input_type', 'select');
        $data['is_filterable'] = $request->boolean('is_filterable', true);
        $data['is_required'] = $request->boolean('is_required', false);
        $data['is_active'] = $request->boolean('is_active', true);
        $data['sort_order'] = $request->sort_order ?? 0;

        if (!empty($data['slug'])) {
            $data['slug'] = Str::slug($data['slug']);
        }

        $attribute = CategoryAttribute::create($data);

        if ($request->filled('values') && is_array($request->values)) {
            foreach ($request->values as $index => $value) {
                AttributeValue::create([
                    'attribute_id' => $attribute->id,
                    'value' => $value['value'],
                    'value_bn' => $value['value_bn'] ?? null,
                    'sort_order' => $value['sort_order'] ?? $index,
                    'is_active' => $value['is_active'] ?? true,
                ]);
            }
        }

        AuditLog::log($request->user(), 'create_category_attribute', 'CategoryAttribute', $attribute->id, null, $attribute->toArray(), 'Category attribute created');

        return $this->created(
            new CategoryAttributeResource($attribute->load(['values' => fn($q) => $q->orderBy('sort_order')])),
            'Category attribute created'
        );
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'slug' => 'nullable|string|max:255',
            'unit' => 'nullable|string|max:50',
            'input_type' => 'nullable|in:select,multiselect,text,number',
            'is_filterable' => 'nullable|boolean',
            'is_required' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $attribute = CategoryAttribute::findOrFail($id);
        $oldData = $attribute->toArray();

        $data = $request->only(['name', 'name_bn', 'slug', 'unit', 'input_type', 'sort_order']);

        if ($request->has('is_filterable')) {
            $data['is_filterable'] = $request->boolean('is_filterable');
        }
        if ($request->has('is_required')) {
            $data['is_required'] = $request->boolean('is_required');
        }
        if ($request->has('is_active')) {
            $data['is_active'] = $request->boolean('is_active');
        }
        if (!empty($data['slug'])) {
            $data['slug'] = Str::slug($data['slug']);
        }

        $attribute->update($data);

        AuditLog::log($request->user(), 'update_category_attribute', 'CategoryAttribute', $attribute->id, $oldData, $attribute->toArray(), 'Category attribute updated');

        return $this->success(
            new CategoryAttributeResource($attribute->fresh(['values' => fn($q) => $q->orderBy('sort_order')])),
            'Category attribute updated'
        );
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $attribute = CategoryAttribute::findOrFail($id);

        AuditLog::log($request->user(), 'delete_category_attribute', 'CategoryAttribute', $attribute->id, $attribute->toArray(), null, 'Category attribute deleted');

        $attribute->delete();

        return $this->success(null, 'Category attribute deleted');
    }

    // ========== ADMIN: ATTRIBUTE VALUES ==========

    public function storeValue(Request $request, int $attributeId): JsonResponse
    {
        $request->validate([
            'value' => 'required|string|max:255',
            'value_bn' => 'nullable|string|max:255',
            'slug' => 'nullable|string|max:255',
            'sort_order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        $attribute = CategoryAttribute::findOrFail($attributeId);

        $data = $request->only(['value', 'value_bn', 'slug', 'sort_order']);
        $data['attribute_id'] = $attribute->id;
        $data['sort_order'] = $request->sort_order ?? 0;
        $data['is_active'] = $request->boolean('is_active', true);

        if (!empty($data['slug'])) {
            $data['slug'] = Str::slug($data['slug']);
        }

        $value = AttributeValue::create($data);

        return $this->created(new AttributeValueResource($value), 'Attribute value created');
    }

    public function updateValue(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'value' => 'sometimes|string|max:255',
            'value_bn' => 'nullable|string|max:255',
            'slug' => 'nullable|string|max:255',
            'sort_order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        $value = AttributeValue::findOrFail($id);

        $data = $request->only(['value', 'value_bn', 'slug', 'sort_order']);
        if ($request->has('is_active')) {
            $data['is_active'] = $request->boolean('is_active');
        }
        if (!empty($data['slug'])) {
            $data['slug'] = Str::slug($data['slug']);
        }

        $value->update($data);

        return $this->success(new AttributeValueResource($value->fresh()), 'Attribute value updated');
    }

    public function destroyValue(int $id): JsonResponse
    {
        $value = AttributeValue::findOrFail($id);
        $value->delete();

        return $this->success(null, 'Attribute value deleted');
    }

    public function bulkSyncValues(Request $request, int $attributeId): JsonResponse
    {
        $request->validate([
            'values' => 'required|array',
            'values.*.id' => 'nullable|integer|exists:attribute_values,id',
            'values.*.value' => 'required|string|max:255',
            'values.*.value_bn' => 'nullable|string|max:255',
            'values.*.sort_order' => 'nullable|integer',
            'values.*.is_active' => 'nullable|boolean',
        ]);

        $attribute = CategoryAttribute::findOrFail($attributeId);

        $incomingIds = [];
        foreach ($request->values as $index => $item) {
            if (!empty($item['id'])) {
                $av = AttributeValue::where('id', $item['id'])->where('attribute_id', $attribute->id)->first();
                if ($av) {
                    $av->update([
                        'value' => $item['value'],
                        'value_bn' => $item['value_bn'] ?? null,
                        'sort_order' => $item['sort_order'] ?? $index,
                        'is_active' => $item['is_active'] ?? true,
                    ]);
                    $incomingIds[] = $av->id;
                }
            } else {
                $av = AttributeValue::create([
                    'attribute_id' => $attribute->id,
                    'value' => $item['value'],
                    'value_bn' => $item['value_bn'] ?? null,
                    'sort_order' => $item['sort_order'] ?? $index,
                    'is_active' => $item['is_active'] ?? true,
                ]);
                $incomingIds[] = $av->id;
            }
        }

        // Remove values not in incoming list
        AttributeValue::where('attribute_id', $attribute->id)
            ->whereNotIn('id', $incomingIds)
            ->delete();

        return $this->success(
            new CategoryAttributeResource($attribute->fresh(['values' => fn($q) => $q->orderBy('sort_order')])),
            'Attribute values synced'
        );
    }

    // ========== PUBLIC: FILTER ATTRIBUTES FOR CATEGORY ==========

    /**
     * Get filter attributes (inherited from ancestors) for a category along with
     * each value's product count within the category + its descendants.
     */
    public function filterAttributesForCategory(Request $request, int $categoryId): JsonResponse
    {
        $category = ProductCategory::findOrFail($categoryId);

        $attributes = $category->getInheritedAttributes()
            ->where('is_filterable', true)
            ->values();

        // Collect all descendant category IDs to scope product counts
        $descendantIds = $this->getAllDescendantIds($category->id);

        // Count products per value for every attribute in one aggregate query
        $attributeIds = $attributes->pluck('id')->all();

        $countsByValue = DB::table('product_attribute_values as pav')
            ->join('products as p', 'p.id', '=', 'pav.product_id')
            ->whereIn('pav.attribute_id', $attributeIds)
            ->whereIn('p.category_id', $descendantIds)
            ->where('p.is_active', true)
            ->whereNull('p.deleted_at')
            ->select('pav.attribute_value_id', DB::raw('COUNT(DISTINCT p.id) as products_count'))
            ->groupBy('pav.attribute_value_id')
            ->pluck('products_count', 'attribute_value_id');

        $payload = $attributes->map(function (CategoryAttribute $attr) use ($countsByValue) {
            $values = $attr->values->map(function (AttributeValue $v) use ($countsByValue) {
                return [
                    'id' => $v->id,
                    'attribute_id' => $v->attribute_id,
                    'value' => $v->value,
                    'value_bn' => $v->value_bn,
                    'slug' => $v->slug,
                    'sort_order' => (int) $v->sort_order,
                    'is_active' => (bool) $v->is_active,
                    'products_count' => (int) ($countsByValue[$v->id] ?? 0),
                ];
            })->filter(fn($v) => $v['is_active'])->values();

            return [
                'id' => $attr->id,
                'category_id' => $attr->category_id,
                'name' => $attr->name,
                'name_bn' => $attr->name_bn,
                'slug' => $attr->slug,
                'unit' => $attr->unit,
                'input_type' => $attr->input_type,
                'is_filterable' => (bool) $attr->is_filterable,
                'is_required' => (bool) $attr->is_required,
                'sort_order' => (int) $attr->sort_order,
                'values' => $values,
            ];
        })->filter(fn($a) => count($a['values']) > 0)->values();

        return $this->success($payload);
    }

    /**
     * Return the attributes (with all values) that apply to a category,
     * as needed by the admin product form when the user picks a category.
     * Includes inherited attributes from ancestors.
     */
    public function attributesForProductForm(int $categoryId): JsonResponse
    {
        $category = ProductCategory::findOrFail($categoryId);

        $attributes = $category->getInheritedAttributes();

        return $this->success(CategoryAttributeResource::collection($attributes));
    }

    private function getAllDescendantIds(int $categoryId): array
    {
        $ids = [$categoryId];
        $children = ProductCategory::where('parent_id', $categoryId)->pluck('id')->toArray();
        foreach ($children as $childId) {
            $ids = array_merge($ids, $this->getAllDescendantIds($childId));
        }
        return $ids;
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Models\QuotationTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuotationTemplateController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $query = QuotationTemplate::query()->orderByDesc('is_default')->orderBy('title');

        if ($request->filled('type')) {
            $query->where('type', $request->get('type'));
        }

        return $this->success($query->get());
    }

    private function rules(): array
    {
        return [
            'type'       => 'required|in:notes,terms',
            'title'      => 'required|string|max:255',
            'content'    => 'required|string|max:2000',
            'is_default' => 'nullable|boolean',
        ];
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());

        // At most one default per type — clear any existing default of the same type before
        // this one takes over, rather than requiring the admin to unset it manually first.
        if (!empty($data['is_default'])) {
            QuotationTemplate::where('type', $data['type'])->update(['is_default' => false]);
        }

        $template = QuotationTemplate::create([
            'type'       => $data['type'],
            'title'      => $data['title'],
            'content'    => $data['content'],
            'is_default' => (bool) ($data['is_default'] ?? false),
            'created_by' => $request->user()->id,
        ]);

        return $this->created($template);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $template = QuotationTemplate::find($id);
        if (!$template) {
            return $this->notFound('Template not found');
        }

        $data = $request->validate($this->rules());

        if (!empty($data['is_default'])) {
            QuotationTemplate::where('type', $data['type'])->where('id', '!=', $id)->update(['is_default' => false]);
        }

        $template->update([
            'type'       => $data['type'],
            'title'      => $data['title'],
            'content'    => $data['content'],
            'is_default' => (bool) ($data['is_default'] ?? false),
        ]);

        return $this->success($template->fresh());
    }

    public function destroy(int $id): JsonResponse
    {
        $template = QuotationTemplate::find($id);
        if (!$template) {
            return $this->notFound('Template not found');
        }

        $template->delete();

        return $this->success(null, 'Template deleted');
    }
}

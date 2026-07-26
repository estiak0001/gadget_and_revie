<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class RegisterVendorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'business_name' => ['required', 'string', 'max:255'],
            'owner_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:20', 'unique:users,phone'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'description' => ['nullable', 'string'],
            'address' => ['nullable', 'string', 'max:500'],
            'google_maps_link' => ['nullable', 'url', 'max:500'],
            'division_id' => ['required', 'exists:divisions,id'],
            'district_id' => ['required', 'exists:districts,id'],
            'area_id' => ['nullable', 'exists:areas,id'],
            'bkash_number' => ['nullable', 'string', 'max:20'],
            'nagad_number' => ['nullable', 'string', 'max:20'],
            'bank_account_name' => ['nullable', 'string', 'max:255'],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'bank_account_number' => ['nullable', 'string', 'max:50'],
            'bank_branch' => ['nullable', 'string', 'max:255'],
            'payment_instructions' => ['nullable', 'string'],
            'trade_license' => ['nullable', 'string', 'max:255'],
            'nid_number' => ['nullable', 'string', 'max:50'],
            'service_category_ids' => ['required', 'array', 'min:1'],
            'service_category_ids.*' => ['exists:service_categories,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'service_category_ids.required' => 'Please select at least one service category.',
            'service_category_ids.min' => 'Please select at least one service category.',
            'email.unique' => 'This email address is already registered.',
            'phone.unique' => 'This phone number is already registered.',
        ];
    }
}

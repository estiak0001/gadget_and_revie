<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Accepts phone number OR email address (phone is the primary identifier)
            'phone_or_email' => ['required', 'string', 'max:255'],
            'password'       => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'phone_or_email.required' => 'Please enter your phone number or email address.',
        ];
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ServiceIntakeItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'service_intake_id',
        'service_id',
        'item_name',
        'serial_number',
        'problem_reported',
        'accessories',
        'condition_notes',
        'quantity',
        'estimated_price',
        'status',
    ];

    protected $casts = [
        'quantity'        => 'integer',
        'estimated_price' => 'decimal:2',
    ];

    public function serviceIntake()
    {
        return $this->belongsTo(ServiceIntake::class);
    }

    public function service()
    {
        return $this->belongsTo(Service::class);
    }
}

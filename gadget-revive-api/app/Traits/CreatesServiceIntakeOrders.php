<?php

namespace App\Traits;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PaymentNotice;
use App\Models\Service;
use App\Models\ServiceIntake;
use App\Models\ServiceIntakeItem;

trait CreatesServiceIntakeOrders
{
    /**
     * Place an e-commerce service order.
     *
     * Unlike a product order, a service order has no agreed price at the time
     * it is placed: the customer requests a service, the device is received as
     * a service intake (status "received") with no cost, and the price is only
     * set later when the admin confirms it on the linked order. Until then the
     * customer can download the service receipt; once the price is confirmed an
     * invoice becomes available.
     *
     * The order is created with a zero total and a single zero-priced line item
     * as a placeholder — both are rebuilt with the confirmed amounts when the
     * admin calls ServiceIntakeController::confirmPrice().
     *
     * Must be called inside an open DB transaction.
     *
     * @param  array{
     *     customer_id?: int|null,
     *     session_id?: string|null,
     *     vendor_profile_id?: int|null,
     *     payment_method: string,
     *     customer_name: string,
     *     customer_phone: string,
     *     customer_email?: string|null,
     *     customer_address?: string|null,
     *     division_id?: int|null,
     *     district_id?: int|null,
     *     area_id?: int|null,
     *     customer_notes?: string|null,
     *     created_by?: int|null,
     * }  $attrs
     */
    protected function placeServiceOrderWithIntake(Service $service, array $attrs): Order
    {
        $order = Order::create([
            'session_id'        => $attrs['session_id'] ?? null,
            'customer_id'       => $attrs['customer_id'] ?? null,
            'vendor_profile_id' => $attrs['vendor_profile_id'] ?? $service->vendor_profile_id,
            'subtotal'          => 0,
            'tax'               => 0,
            'shipping'          => 0,
            'discount'          => 0,
            'total'             => 0,
            'payment_method'    => $attrs['payment_method'],
            'payment_status'    => 'pending',
            'order_status'      => 'pending',
            'customer_name'     => $attrs['customer_name'],
            'customer_phone'    => $attrs['customer_phone'],
            'customer_email'    => $attrs['customer_email'] ?? null,
            'customer_address'  => $attrs['customer_address'] ?? null,
            'division_id'       => $attrs['division_id'] ?? null,
            'district_id'       => $attrs['district_id'] ?? null,
            'area_id'           => $attrs['area_id'] ?? null,
            'customer_notes'    => $attrs['customer_notes'] ?? null,
        ]);

        // Placeholder line item — replaced with the confirmed price later.
        OrderItem::create([
            'order_id'    => $order->id,
            'item_type'   => 'service',
            'service_id'  => $service->id,
            'item_name'   => $service->name,
            'item_sku'    => $service->code,
            'quantity'    => 1,
            'unit_price'  => 0,
            'total_price' => 0,
        ]);

        PaymentNotice::create([
            'order_id'           => $order->id,
            'method'             => $attrs['payment_method'],
            'instructions_shown' => null,
            'amount'             => 0,
            'status'             => 'pending',
        ]);

        // The device enters service intake as "received" with no cost. It is
        // already linked to the order so the admin uses confirmPrice() (not
        // convertToOrder()) once the price is agreed with the customer.
        $intake = ServiceIntake::create([
            'customer_id'      => $attrs['customer_id'] ?? null,
            'order_id'         => $order->id,
            'customer_name'    => $attrs['customer_name'],
            'customer_phone'   => $attrs['customer_phone'],
            'customer_email'   => $attrs['customer_email'] ?? null,
            'customer_address' => $attrs['customer_address'] ?? null,
            'division_id'      => $attrs['division_id'] ?? null,
            'district_id'      => $attrs['district_id'] ?? null,
            'area_id'          => $attrs['area_id'] ?? null,
            'status'           => 'received',
            'estimated_cost'   => null,
            'received_at'      => now(),
            'notes'            => $attrs['customer_notes'] ?? null,
            'created_by'       => $attrs['created_by'] ?? null,
        ]);

        ServiceIntakeItem::create([
            'service_intake_id' => $intake->id,
            'service_id'        => $service->id,
            'item_name'         => $service->name,
            'problem_reported'  => $attrs['customer_notes'] ?? null,
            'quantity'          => 1,
            'estimated_price'   => null,
        ]);

        return $order;
    }
}

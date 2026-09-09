<?php

namespace Database\Seeders;

use App\Models\LoungeTable;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $roles = collect([
            ['name' => 'Super Admin', 'description' => 'Mengelola seluruh sistem'],
            ['name' => 'Admin', 'description' => 'Mengelola operasional dan laporan'],
            ['name' => 'Kasir', 'description' => 'Menjalankan transaksi kasir'],
        ])->map(fn ($role) => Role::updateOrCreate(
            ['name' => $role['name']],
            ['description' => $role['description']],
        ))->keyBy('name');

        $permissions = collect([
            ['name' => 'manage_system', 'module' => 'system', 'description' => 'Konfigurasi sistem'],
            ['name' => 'manage_users', 'module' => 'users', 'description' => 'Kelola user dan password'],
            ['name' => 'manage_products', 'module' => 'products', 'description' => 'Kelola produk dan kategori'],
            ['name' => 'manage_transactions', 'module' => 'transactions', 'description' => 'Kelola transaksi'],
            ['name' => 'view_reports', 'module' => 'reports', 'description' => 'Lihat laporan'],
            ['name' => 'operate_cashier', 'module' => 'pos', 'description' => 'Operasi kasir'],
        ])->map(fn ($permission) => Permission::updateOrCreate(
            ['name' => $permission['name']],
            [
                'module' => $permission['module'],
                'description' => $permission['description'],
            ],
        ))->keyBy('name');

        $roles['Super Admin']->permissions()->sync($permissions->pluck('id'));
        $roles['Admin']->permissions()->sync($permissions->only(['manage_products', 'manage_transactions', 'view_reports'])->pluck('id'));
        $roles['Kasir']->permissions()->sync($permissions->only(['operate_cashier', 'view_reports'])->pluck('id'));

        User::firstOrCreate(
            ['username' => 'superadmin'],
            ['role_id' => $roles['Super Admin']->id, 'name' => 'Owner POS BILLING', 'password' => 'SuperAdminPW666', 'status' => 'active'],
        );
        User::firstOrCreate(
            ['username' => 'admin'],
            ['role_id' => $roles['Admin']->id, 'name' => 'Admin Operasional', 'password' => 'IniADMIN333', 'status' => 'active'],
        );
        User::firstOrCreate(
            ['username' => 'kasir1'],
            ['role_id' => $roles['Kasir']->id, 'name' => 'Sinta Kasir', 'password' => 'password', 'status' => 'active'],
        );
        User::firstOrCreate(
            ['username' => 'kasir2'],
            ['role_id' => $roles['Kasir']->id, 'name' => 'Raka Kasir', 'password' => 'password', 'status' => 'active'],
        );

        $this->call(ProductCatalogSeeder::class);

        for ($index = 0; $index < 18; $index++) {
            $col = $index % 6;
            $row = intdiv($index, 6);
            $number = chr(65 + $row).str_pad((string) ($col + 1), 2, '0', STR_PAD_LEFT);

            LoungeTable::firstOrCreate(
                ['number' => $number],
                [
                    'name' => 'Table '.$number,
                    'position_x' => 40 + ($col * 128),
                    'position_y' => 42 + ($row * 116),
                    'status' => 'available',
                    'notes' => $index % 5 === 0 ? 'Dekat VIP lounge' : null,
                ],
            );
        }
    }
}

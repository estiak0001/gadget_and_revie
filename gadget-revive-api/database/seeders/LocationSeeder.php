<?php

namespace Database\Seeders;

use App\Models\Area;
use App\Models\District;
use App\Models\Division;
use Illuminate\Database\Seeder;

class LocationSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Bangladesh divisions with their districts and sample areas
        $locations = [
            'Dhaka' => [
                'Dhaka' => ['Gulshan', 'Banani', 'Dhanmondi', 'Mirpur', 'Uttara', 'Mohammadpur', 'Motijheel', 'Badda', 'Tejgaon', 'Khilgaon'],
                'Gazipur' => ['Gazipur Sadar', 'Tongi', 'Kaliakair', 'Kaliganj', 'Kapasia'],
                'Narayanganj' => ['Narayanganj Sadar', 'Siddhirganj', 'Fatullah', 'Araihazar', 'Sonargaon'],
                'Tangail' => ['Tangail Sadar', 'Mirzapur', 'Gopalpur', 'Kalihati'],
                'Manikganj' => ['Manikganj Sadar', 'Singair', 'Saturia'],
                'Munshiganj' => ['Munshiganj Sadar', 'Sreenagar', 'Sirajdikhan'],
                'Narsingdi' => ['Narsingdi Sadar', 'Raipura', 'Shibpur'],
                'Faridpur' => ['Faridpur Sadar', 'Alfadanga', 'Boalmari'],
                'Gopalganj' => ['Gopalganj Sadar', 'Kashiani', 'Kotalipara'],
                'Madaripur' => ['Madaripur Sadar', 'Kalkini', 'Rajoir'],
                'Rajbari' => ['Rajbari Sadar', 'Goalanda', 'Pangsha'],
                'Shariatpur' => ['Shariatpur Sadar', 'Naria', 'Gosairhat'],
                'Kishoreganj' => ['Kishoreganj Sadar', 'Bajitpur', 'Bhairab'],
            ],
            'Chattogram' => [
                'Chattogram' => ['Agrabad', 'Nasirabad', 'Panchlaish', 'Kotwali', 'Double Mooring', 'Halishahar', 'Khulshi', 'Pahartali'],
                'Cox\'s Bazar' => ['Cox\'s Bazar Sadar', 'Teknaf', 'Ukhiya', 'Ramu', 'Maheshkhali'],
                'Comilla' => ['Comilla Sadar', 'Laksam', 'Chauddagram', 'Daudkandi'],
                'Feni' => ['Feni Sadar', 'Chhagalnaiya', 'Parshuram'],
                'Lakshmipur' => ['Lakshmipur Sadar', 'Raipur', 'Ramgati'],
                'Noakhali' => ['Noakhali Sadar', 'Begumganj', 'Hatiya'],
                'Brahmanbaria' => ['Brahmanbaria Sadar', 'Ashuganj', 'Nabinagar'],
                'Chandpur' => ['Chandpur Sadar', 'Matlab North', 'Matlab South'],
                'Rangamati' => ['Rangamati Sadar', 'Kaptai', 'Bagaichhari'],
                'Khagrachari' => ['Khagrachari Sadar', 'Dighinala', 'Manikchhari'],
                'Bandarban' => ['Bandarban Sadar', 'Thanchi', 'Ruma'],
            ],
            'Rajshahi' => [
                'Rajshahi' => ['Rajshahi City', 'Boalia', 'Rajpara', 'Motihar', 'Shah Makhdum'],
                'Bogra' => ['Bogra Sadar', 'Shibganj', 'Sherpur'],
                'Chapainawabganj' => ['Chapainawabganj Sadar', 'Shibganj', 'Gomastapur'],
                'Joypurhat' => ['Joypurhat Sadar', 'Akkelpur', 'Kalai'],
                'Naogaon' => ['Naogaon Sadar', 'Niamatpur', 'Manda'],
                'Natore' => ['Natore Sadar', 'Bagatipara', 'Baraigram'],
                'Nawabganj' => ['Nawabganj Sadar', 'Bholahat'],
                'Pabna' => ['Pabna Sadar', 'Ishwardi', 'Bera'],
                'Sirajganj' => ['Sirajganj Sadar', 'Shahzadpur', 'Belkuchi'],
            ],
            'Khulna' => [
                'Khulna' => ['Khulna City', 'Khalishpur', 'Sonadanga', 'Boyra', 'Daulatpur'],
                'Jessore' => ['Jessore Sadar', 'Benapole', 'Jhikargachha'],
                'Satkhira' => ['Satkhira Sadar', 'Kalaroa', 'Shyamnagar'],
                'Kushtia' => ['Kushtia Sadar', 'Kumarkhali', 'Mirpur'],
                'Meherpur' => ['Meherpur Sadar', 'Gangni', 'Mujibnagar'],
                'Chuadanga' => ['Chuadanga Sadar', 'Alamdanga', 'Damurhuda'],
                'Jhenaidah' => ['Jhenaidah Sadar', 'Shailkupa', 'Harinakundu'],
                'Narail' => ['Narail Sadar', 'Kalia', 'Lohagara'],
                'Bagerhat' => ['Bagerhat Sadar', 'Mongla', 'Rampal'],
                'Magura' => ['Magura Sadar', 'Shalikha', 'Sreepur'],
            ],
            'Sylhet' => [
                'Sylhet' => ['Sylhet City', 'Zindabazar', 'Amberkhana', 'Subid Bazar', 'Tilagarh'],
                'Habiganj' => ['Habiganj Sadar', 'Chunarughat', 'Madhabpur'],
                'Moulvibazar' => ['Moulvibazar Sadar', 'Sreemangal', 'Kulaura'],
                'Sunamganj' => ['Sunamganj Sadar', 'Tahirpur', 'Jamalganj'],
            ],
            'Barishal' => [
                'Barishal' => ['Barishal City', 'Kotwali', 'Banaripara', 'Babuganj'],
                'Barguna' => ['Barguna Sadar', 'Patharghata', 'Amtali'],
                'Bhola' => ['Bhola Sadar', 'Daulatkhan', 'Borhanuddin'],
                'Jhalokathi' => ['Jhalokathi Sadar', 'Nalchity', 'Kathalia'],
                'Patuakhali' => ['Patuakhali Sadar', 'Kuakata', 'Kalapara'],
                'Pirojpur' => ['Pirojpur Sadar', 'Mathbaria', 'Nesarabad'],
            ],
            'Rangpur' => [
                'Rangpur' => ['Rangpur City', 'Kotwali', 'Gangachara', 'Badarganj'],
                'Dinajpur' => ['Dinajpur Sadar', 'Phulbari', 'Birampur'],
                'Gaibandha' => ['Gaibandha Sadar', 'Gobindaganj', 'Palashbari'],
                'Kurigram' => ['Kurigram Sadar', 'Ulipur', 'Nageshwari'],
                'Lalmonirhat' => ['Lalmonirhat Sadar', 'Aditmari', 'Kaliganj'],
                'Nilphamari' => ['Nilphamari Sadar', 'Saidpur', 'Domar'],
                'Panchagarh' => ['Panchagarh Sadar', 'Tetulia', 'Boda'],
                'Thakurgaon' => ['Thakurgaon Sadar', 'Pirganj', 'Baliadangi'],
            ],
            'Mymensingh' => [
                'Mymensingh' => ['Mymensingh Sadar', 'Trishal', 'Bhaluka', 'Muktagachha'],
                'Jamalpur' => ['Jamalpur Sadar', 'Dewanganj', 'Islampur'],
                'Netrokona' => ['Netrokona Sadar', 'Mohanganj', 'Kendua'],
                'Sherpur' => ['Sherpur Sadar', 'Nalitabari', 'Jhenaigati'],
            ],
        ];

        foreach ($locations as $divisionName => $districts) {
            $division = Division::create([
                'name' => $divisionName,
                'name_bn' => $divisionName, // Would need proper Bengali translation
                'is_active' => true,
            ]);

            foreach ($districts as $districtName => $areas) {
                $district = District::create([
                    'division_id' => $division->id,
                    'name' => $districtName,
                    'name_bn' => $districtName, // Would need proper Bengali translation
                    'is_active' => true,
                ]);

                foreach ($areas as $areaName) {
                    Area::create([
                        'district_id' => $district->id,
                        'name' => $areaName,
                        'name_bn' => $areaName, // Would need proper Bengali translation
                        'is_active' => true,
                    ]);
                }
            }
        }
    }
}

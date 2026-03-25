<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SMSService
{
    /**
     * Send SMS using your preferred provider
     */
    public function send(string $phoneNumber, string $message): bool
    {
        try {
            // Example using Semaphore API (Philippines)
            // $response = Http::asForm()->post('https://api.semaphore.co/api/v4/messages', [
            //     'apikey' => env('SEMAPHORE_API_KEY'),
            //     'number' => $phoneNumber,
            //     'message' => $message,
            //     'sendername' => env('SMS_SENDER_NAME')
            // ]);

            // For development, log the SMS
            Log::info("SMS to {$phoneNumber}: {$message}");

            return true;
        } catch (\Exception $e) {
            Log::error("SMS failed: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send OTP SMS
     */
    public function sendOtp(string $phoneNumber, string $otp): bool
    {
        $message = "Your Dear Bab's verification code is: {$otp}. Valid for 5 minutes.";
        return $this->send($phoneNumber, $message);
    }
}

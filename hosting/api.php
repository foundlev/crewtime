<?php
if (isset($_SERVER['HTTP_ORIGIN'])) {
    // если хочешь отражать конкретный Origin:
    // header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
    // header('Vary: Origin');
    // а если пофиг — просто *:
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400'); // кэш preflight на сутки

// Preflight запрос — отвечаем и выходим
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json');

define('LOGIN_URL', 'https://crew.aeroflot.ru/auth/login');
define('SCHEDULE_URL', 'https://crew.aeroflot.ru/api/flying-activity/operating-schedule');
$username = $_REQUEST['username'] ?? '';
$password = $_REQUEST['password'] ?? '';

if (!$username || !$password) {
    echo json_encode(['success' => false, 'error' => 'Missing username or password'], JSON_UNESCAPED_UNICODE);
    exit;
}

define('USERNAME', $username);
define('PASSWORD', $password);
define('WEB_BOARD_URL', 'https://flights.aeroflot.ru/api/flights/v1.1/ru/board');
define('CALENDAR_URL', 'https://mycalendar-sync.na4u.ru/calendar.json');

function login() {
    $ch = curl_init(LOGIN_URL);
    $payload = json_encode(['username' => USERNAME, 'password' => PASSWORD]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json;charset=utf-8',
        'Accept: application/json, text/plain, */*',
        'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
        'Origin: https://crew.aeroflot.ru',
        'Referer: https://crew.aeroflot.ru/'
    ]);
    curl_setopt($ch, CURLOPT_HEADER, true);
    
    $response = curl_exec($ch);
    $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $header = substr($response, 0, $header_size);
    $body = substr($response, $header_size);
    curl_close($ch);

    $token = '';
    if (preg_match('/COOKIE_ACCESS_TOKEN=([^;]+)/', $header, $matches)) {
        $token = $matches[1];
    }

    return $token;
}

function fetchSchedule($token) {
    $ch = curl_init(SCHEDULE_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json, text/plain, */*',
        'Authorization: Bearer ' . ($token ?: '1'),
        'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
        'Referer: https://crew.aeroflot.ru/flying-activity'
    ]);
    if ($token) {
        curl_setopt($ch, CURLOPT_COOKIE, "COOKIE_ACCESS_TOKEN=$token");
    }

    $response = curl_exec($ch);
    curl_close($ch);
    return json_decode($response, true);
}

function fetchWebFlightData($flightNumber, $date, $depIata, $arrIata, &$debug = null) {
    // $date приходит в UTC (напр. 2026-01-14T23:00:00Z)
    // Веб-табло Аэрофлота ожидает дату вылета по местному времени (или MSK)
    $dt = new DateTime($date, new DateTimeZone('UTC'));
    $dt->setTimezone(new DateTimeZone('Europe/Moscow'));
    $queryDateFrom = $dt->format('Y-m-d') . 'T00:00:00';
    
    $dtTo = clone $dt;
    $dtTo->modify('+1 day');
    $queryDateTo = $dtTo->format('Y-m-d') . 'T00:00:00';

    $url = WEB_BOARD_URL . "?dateFrom={$queryDateFrom}&dateTo={$queryDateTo}&departure={$depIata}&arrival={$arrIata}";

    if ($debug !== null) {
        $debug['web_url'] = $url;
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    
    $referer = "https://flights.aeroflot.ru/ru-ru/onlineboard/route/{$depIata}-{$arrIata}-" . $dt->format('Ymd');
    
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json, text/plain, */*',
        'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Safari/605.1.15',
        'Referer: ' . $referer,
        'Accept-Language: ru'
    ]);

    $response = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);

    if ($debug !== null) {
        $debug['web_curl_error'] = $error;
        $debug['web_response_empty'] = empty($response);
    }

    if (!$response) return null;
    $data = json_decode($response, true);
    
    if ($debug !== null) {
        $debug['web_json_error'] = json_last_error_msg();
        if (isset($data['data']['routes'])) {
            $debug['web_routes_count'] = count($data['data']['routes']);
        }
    }

    if (!isset($data['data']['routes'])) return null;

    $targetNumber = (int) preg_replace('/[^0-9]/', '', $flightNumber);

    if ($debug !== null) {
        $debug['target_number'] = $targetNumber;
        $debug['found_numbers'] = [];
    }

    foreach ($data['data']['routes'] as $route) {
        $leg = $route['leg'] ?? [];
        $webDep = $leg['departure']['scheduled']['airportCode'] ?? '';
        $webArr = $leg['arrival']['scheduled']['airportCode'] ?? '';
        $routeNumberFull = $route['flightId']['flightNumber'] ?? '';
        $routeNumber = (int) preg_replace('/[^0-9]/', '', $routeNumberFull);

        if ($debug !== null) {
            $debug['found_numbers'][] = $routeNumber;
        }

        if ($webDep === $depIata && $webArr === $arrIata && $routeNumber === $targetNumber) {
            $startDate = new DateTime($leg['departure']['times']['scheduledDeparture']['utc'] ?? 'now', new DateTimeZone('UTC'));
            $endDate = new DateTime($leg['arrival']['times']['scheduledArrival']['utc'] ?? 'now', new DateTimeZone('UTC'));
            
            $interval = $startDate->diff($endDate);
            $duration = sprintf('%02d:%02d', $interval->h + ($interval->days * 24), $interval->i);

            return [
                'startDate' => $startDate->format('Y-m-d\TH:i:s\Z'),
                'duration' => $duration,
                'departure' => [
                    'iata' => $webDep,
                    'city' => $leg['departure']['scheduled']['city'] ?? '',
                    'gate' => $leg['departure']['gate'] ?? '',
                    'parkingStand' => $leg['departure']['parkingStand'] ?? '',
                    'terminal' => $leg['departure']['terminal'] ?? ''
                ],
                'arrival' => [
                    'iata' => $webArr,
                    'city' => $leg['arrival']['scheduled']['city'] ?? '',
                    'gate' => $leg['arrival']['gate'] ?? '',
                    'parkingStand' => $leg['arrival']['parkingStand'] ?? '',
                    'terminal' => $leg['arrival']['terminal'] ?? ''
                ],
                'number' => ($route['flightId']['carrier'] ?? '') . ltrim($route['flightId']['flightNumber'] ?? '', '0'),
                'aircraftType' => $route['equipment']['aircraft']['actual']['title'] ?? 
                                  $route['equipment']['aircraft']['scheduled']['title'] ?? 
                                  $route['equipment']['aircraft']['title'] ??
                                  $route['equipment']['aircraft']['actual']['type'] ?? 
                                  $route['equipment']['aircraft']['scheduled']['type'] ?? 
                                  $route['equipment']['aircraft']['type'] ?? '',
                'status' => $route['status'] ?? 'Scheduled'
            ];
        }
    }

    return null;
}

function fetchCalendarData() {
    $ch = curl_init(CALENDAR_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json, text/plain, */*',
        'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15'
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    return json_decode($response, true);
}

function findNextFlightInFlightsArray($flights, $now) {
    $nextFlight = null;
    $minDiff = null;

    foreach ($flights as $flight) {
        $startDateStr = $flight['startDate'] ?? $flight['time']['start'] ?? null;
        if (!$startDateStr) continue;

        // В calendar.json время в UTC, в accord в MSK. 
        // Если это пришло из accord, там есть поле 'time', в calendar.json сразу 'startDate'
        // В предоставленном JSON из https://mycalendar-sync.na4u.ru/calendar.json 
        // я видел структуру похожую на accord но плоскую или вложенную.
        // Перепроверю curl вывод.
        
        $startDate = new DateTime($startDateStr, new DateTimeZone('Europe/Moscow'));
        $startDate->setTimezone(new DateTimeZone('UTC'));

        if ($startDate > $now) {
            $diff = $startDate->getTimestamp() - $now->getTimestamp();
            if ($minDiff === null || $diff < $minDiff) {
                $minDiff = $diff;
                $nextFlight = $flight;
            }
        }
    }
    return $nextFlight;
}

function isSVO($airport) {
    if (!$airport) return false;
    $code = $airport['code'] ?? $airport['iata'] ?? '';
    $icao = $airport['icao'] ?? '';
    return (strpos($code, 'SVO') === 0 || $icao === 'UUEE');
}

function formatFlightData($flight, $type) {
    if (!$flight) return null;

    $startDate = new DateTime($flight['startDate'] ?? $flight['time']['start'], new DateTimeZone('Europe/Moscow'));
    $startDate->setTimezone(new DateTimeZone('UTC'));
    
    $endDate = new DateTime($flight['endDate'] ?? $flight['time']['end'], new DateTimeZone('Europe/Moscow'));
    $endDate->setTimezone(new DateTimeZone('UTC'));
    
    $interval = $startDate->diff($endDate);
    $duration = sprintf('%02d:%02d', $interval->h + ($interval->days * 24), $interval->i);

    $dep = $flight['departure'] ?? $flight['airports']['departure'];
    $arr = $flight['arrival'] ?? $flight['airports']['arrival'];

    return [
        'startDate' => $startDate->format('Y-m-d\TH:i:s\Z'),
        'duration' => $duration,
        'departure' => [
            'iata' => $dep['iata'] ?? substr($dep['code'] ?? '', 0, 3),
            'icao' => $dep['icao'] ?? '',
            'city' => $dep['city'] ?? explode(',', $dep['name'] ?? '')[0]
        ],
        'arrival' => [
            'iata' => $arr['iata'] ?? substr($arr['code'] ?? '', 0, 3),
            'icao' => $arr['icao'] ?? '',
            'city' => $arr['city'] ?? explode(',', $arr['name'] ?? '')[0]
        ],
        'number' => $flight['number'],
        'aircraftType' => $flight['aircraftType'] ?? $flight['aircraft'],
        'isWork' => $type === 'PAIRING'
    ];
}

function getNextFlight() {
    $now = new DateTime('now', new DateTimeZone('UTC'));
    $debug = [];

    // 1. Accord
    $accordFlight = null;
    try {
        $token = login();
        $data = fetchSchedule($token);
        if (isset($data['data']) && is_array($data['data'])) {
            $allFlights = [];
            foreach ($data['data'] as $month) {
                if (!isset($month['activities'])) continue;
                foreach ($month['activities'] as $activity) {
                    $type = $activity['type'];
                    if ($type !== 'PAIRING' && $type !== 'PASSENGER') continue;
                    if (!isset($activity['item']['flights'])) continue;
                    foreach ($activity['item']['flights'] as $flight) {
                        $flight['_type'] = $type;
                        $allFlights[] = $flight;
                    }
                }
            }
            usort($allFlights, function($a, $b) {
                return strcmp($a['startDate'] ?? '', $b['startDate'] ?? '');
            });

            $nextIdx = -1;
            foreach ($allFlights as $idx => $f) {
                $startDateStr = $f['startDate'] ?? null;
                if (!$startDateStr) continue;
                $startDate = new DateTime($startDateStr, new DateTimeZone('Europe/Moscow'));
                $startDate->setTimezone(new DateTimeZone('UTC'));
                if ($startDate > $now) {
                    $nextIdx = $idx;
                    break;
                }
            }

            if ($nextIdx !== -1) {
                $nextAccord = $allFlights[$nextIdx];
                $accordFlight = formatFlightData($nextAccord, $nextAccord['_type']);
                
                // Находим начало эстафеты (откат до вылета из SVO)
                $startIdx = $nextIdx;
                while ($startIdx > 0) {
                    $f = $allFlights[$startIdx];
                    $dep = $f['departure'] ?? $f['airports']['departure'] ?? null;
                    if (isSVO($dep)) break;
                    $startIdx--;
                }
                
                // Находим конец эстафеты (вперед до прилета в SVO)
                $endIdx = $nextIdx;
                while ($endIdx < count($allFlights) - 1) {
                    $f = $allFlights[$endIdx];
                    $arr = $f['arrival'] ?? $f['airports']['arrival'] ?? null;
                    if (isSVO($arr)) break;
                    $endIdx++;
                }
                
                $relay = [];
                for ($i = $startIdx; $i <= $endIdx; $i++) {
                    $relay[] = formatFlightData($allFlights[$i], $allFlights[$i]['_type']);
                }
                $accordFlight['relay'] = $relay;
            }
        }
    } catch (Exception $e) {}

    // 2. Calendar
    $calendarFlight = null;
    try {
        $calData = fetchCalendarData();
        if (is_array($calData)) {
            $allCalFlights = [];
            foreach ($calData as $activity) {
                $type = $activity['type'] ?? '';
                if ($type !== 'PAIRING' && $type !== 'PASSENGER') continue;
                
                // В calendar.json данные могут быть плоскими (сразу в activity) 
                // или во вложенном item (как в accord).
                $flightItem = $activity['item'] ?? $activity;
                
                if (isset($flightItem['flights']) && is_array($flightItem['flights'])) {
                    foreach ($flightItem['flights'] as $f) {
                        $f['_type'] = $type;
                        $allCalFlights[] = $f;
                    }
                } else {
                    // Если flights нет, возможно это одиночный рейс в самом объекте
                    $flightItem['_type'] = $type;
                    $allCalFlights[] = $flightItem;
                }
            }
            $nextCal = findNextFlightInFlightsArray($allCalFlights, $now);
            if ($nextCal) {
                $calendarFlight = formatFlightData($nextCal, $nextCal['_type']);
            }
        }
    } catch (Exception $e) {}

    // 3. Web (для accord или calendar)
    $webFlight = null;
    $baseFlight = $accordFlight ?: $calendarFlight;
    if ($baseFlight) {
        try {
            $webFlight = fetchWebFlightData(
                $baseFlight['number'],
                $baseFlight['startDate'],
                $baseFlight['departure']['iata'],
                $baseFlight['arrival']['iata'],
                $debug
            );
        } catch (Exception $e) {
            $debug['web_exception'] = $e->getMessage();
        }
    }

    return [
        'success' => true,
        'debug' => $debug,
        'data' => [
            'sources' => [
                'accord' => $accordFlight,
                'web' => $webFlight,
                'calendar' => $calendarFlight
            ]
        ]
    ];
}

echo json_encode(getNextFlight(), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

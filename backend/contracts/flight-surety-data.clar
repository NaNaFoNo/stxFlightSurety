
;; flight-surety-data

;; error consts   ;;;
(define-constant ERR_UNAUTHORISED (err u2011))
(define-constant NOT_WHITELISTED (err u2012))

(define-constant AIRLINE_NOT_FOUND (err u2100))
(define-constant FLIGHT_NOT_FOUND (err u2101))
(define-constant SURETY_NOT_FOUND (err u2102))
(define-constant INDEX_NOT_FOUND (err u2103))
(define-constant ELEMENT_NOT_FOUND (err u2104))
(define-constant MAX_AIRLINES_EXCEEDED (err u2105))
(define-constant MAX_PAYOUT_EXCEEDED (err u2106))
(define-constant AIRLINE_NOT_FUNDED (err u2107))
(define-constant INVALID_FLIGHT_STATUS (err u2108))
(define-constant FLIGHT_STATUS_PENDING (err u2109))

;; constants
;;
(define-constant CONTRACT_OWNER tx-sender)
(define-constant CONTRACT_ADDRESS (as-contract tx-sender))

;; data maps and vars
;;
(define-data-var idCounter uint u0)
(define-data-var regAirlinesCount uint u0)
(define-data-var regFlightsCount uint u0)

(define-map AuthorizedCallers principal bool)
(define-map Airlines 
  principal 
  { 
    airline-id: uint,
    airline-state: uint,
    airline-name: (string-ascii 40),
    voters:  (list 25 principal),
  }
)
(define-map RegisteredAirlines uint principal)   ;; < implement , could be useful .... done for airline deployment, contract logic tbd
(define-map AirlinesFund principal uint)

(define-map Flights 
  { flight-number: (string-ascii 7), airline-id: uint } 
  { 
    flight-id: uint,
    active: bool,
    status-code: (list 4 uint),
    payout: (list 4 uint),
    max-payout: uint,
  }
)
(define-map RegisteredFlights uint {flight-number: (string-ascii 7), airline-id: uint })
(define-map FlightStatuses { flight-id: uint, departure: int } uint)

(define-map Sureties 
  {
    insuree: principal,
    flight-id: uint,
  } 
  {
    departure: int,
    payouts: {
      code: (list 4 uint),
      amount: (list 4 uint)
    },
  }
)


;; init first airline on deployment
;;
(var-set idCounter u1)
(map-set Airlines 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
  { 
    airline-id: u1,
    airline-state: u2,
    airline-name: "First Airline",
    voters:  (list ),
  }
)
(map-set RegisteredAirlines u1 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
(var-set regAirlinesCount u1)


;; whitelisting
;;
(define-read-only (is-whitelisted (app-contract principal))
	(default-to false (map-get? AuthorizedCallers app-contract))
)

(define-public (set-whitelisted (appContract principal) (whitelisted bool))
	(begin
		(asserts! (is-eq CONTRACT_OWNER tx-sender) ERR_UNAUTHORISED)
    ;; #[filter(appContract, whitelisted)]
		(ok (map-set AuthorizedCallers appContract whitelisted))
	)
)


;; airlines
;;
(define-private (register-airline (airline principal) (id uint))
  (begin 
    (map-set RegisteredAirlines id airline)
    (var-set regAirlinesCount (+ (var-get regAirlinesCount) u1))
  )
)

(define-private (set-airline-state (airline principal) (state uint))
  (map-set Airlines airline (merge (unwrap-panic (get-airline airline)) {airline-state: state}))
)

(define-read-only (get-airlines-count) 
  (var-get regAirlinesCount)
)

(define-read-only (get-airline (airline principal)) 
  (map-get? Airlines airline)
)

(define-read-only (get-airline-by-flight (flightId uint))
  (let
    (
      (airlineId (get airline-id (unwrap! (map-get? RegisteredFlights flightId) FLIGHT_NOT_FOUND)))
    )
    (ok (unwrap! (map-get? RegisteredAirlines airlineId) AIRLINE_NOT_FOUND))
  )
)

(define-public (add-airline-data (airline principal) (airlineName (string-ascii 30)) (caller principal) (status uint)) 
  (let 
    (
      (airlineData (get-airline airline))
      (id (if (is-none airlineData) 
          (+ (var-get idCounter) u1) 
          (unwrap-panic (get airline-id airlineData))
      ))
      (voteList (if (is-none airlineData) 
          (list caller) 
          (append (unwrap-panic (get voters airlineData)) caller)
      ))
    )
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED)
    ;; #[filter(airline, airlineName, caller, status)]
    (map-set Airlines airline {
      airline-id: id,
      airline-state: status,
      airline-name: airlineName,
      voters:  (unwrap! (as-max-len? voteList u25) MAX_AIRLINES_EXCEEDED),
    })
    (if (is-none airlineData) (var-set idCounter id) false)
    (if (is-eq status u2) (register-airline airline id) false) 
    (ok {airline-id: id, airline-state: status, votes: (len voteList), reg-airlines: (var-get regAirlinesCount) })
  )
)

(define-public (funded-airline-state (airline principal) (funding uint))
  (begin
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED)
    (asserts! (is-some (get-airline airline) ) AIRLINE_NOT_FOUND)
    ;; #[filter(airline, funding)]
    (map-set AirlinesFund airline funding)
    (ok (set-airline-state airline u3))
  )
)


;;  flights
;;
(define-read-only (get-flight (airlineId uint) (flightNumber (string-ascii 7)))
  (map-get? Flights { flight-number: flightNumber, airline-id: airlineId })
)


(define-public (register-flight (airlineId uint) (flightNumber (string-ascii 7)) (activate bool) (payouts {status: (list 4 uint),payout: (list 4 uint) }) (maxPayout uint))
  (let
    (
      (counter (+ (var-get regFlightsCount) u1))
    )
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED)
    ;; #[filter(flightNumber, airlineId, activate, payouts, maxPayout)]
    (map-set Flights { flight-number: flightNumber, airline-id: airlineId } {
      flight-id: counter,
      active: activate,
      status-code: (get status payouts),
      payout: (get payout payouts),
      max-payout: maxPayout,
    })
    (map-set RegisteredFlights counter {flight-number: flightNumber, airline-id: airlineId })
    (var-set regFlightsCount counter)
    (ok {result: true, message: "Flight registered", flight-id: counter})
  )
)

(define-public (update-flight-status (flightId uint) (departure int) (status uint))
  (begin
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED)
      ;; #[filter(flightId, departure, status)]
    (map-set FlightStatuses {flight-id: flightId, departure: departure} status)
    (ok {result: true, message: "Flight status updated", flight-id: flightId, status: status})
  )
)


;; purchase sureties
;;
(define-private (calculate-amounts (multiplier (list 4 uint)) (amount uint) ) 
  (map / (map * (list amount amount amount amount) multiplier) (list u100 u100 u100 u100)) 
)

(define-private (check-max-amount (max uint) (amounts (list 4 uint))) 
  (match (index-of (map >= (list max max max max) amounts) false) value false true)
)

(define-read-only (get-surety (insuree principal) (flightId uint))
  (map-get? Sureties {insuree: insuree, flight-id: flightId})
)

(define-public (purchase-surety (insuree principal) (flightId uint) (departure int) (amount uint))
  (let
    (
      (flightParameter (unwrap! (map-get? RegisteredFlights flightId) FLIGHT_NOT_FOUND))
      (flight (unwrap! (map-get? Flights flightParameter) FLIGHT_NOT_FOUND))
      (amounts (calculate-amounts (get payout flight) amount))
      (status (default-to u0 (map-get? FlightStatuses {flight-id: flightId, departure: departure})))
      (airline (unwrap! (map-get? RegisteredAirlines (get airline-id flightParameter)) AIRLINE_NOT_FOUND))
      (airlineFund (unwrap! (map-get? AirlinesFund airline) AIRLINE_NOT_FUNDED))
    )
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED)
    (asserts! (check-max-amount (get max-payout flight) amounts) MAX_PAYOUT_EXCEEDED)
    (asserts! (is-eq status u0) INVALID_FLIGHT_STATUS)
    ;;; check timestamp is min 1 day in future
    ;; #[filter(flightId, airlineId, insuree, departure)]
    (map-insert Sureties {insuree: insuree, flight-id: flightId} {
      departure: 	departure,
      payouts: { code: (get status-code flight), amount: amounts },
    })
    (map-insert FlightStatuses {flight-id: flightId, departure: departure} u0)
    (map-set AirlinesFund airline (+ amount airlineFund))  ;; to airlineID
    (ok {result: true, message: "Surety purchased"})
  )
)

(define-public (redeem-surety (insuree principal) (flightId uint)) 
  (let
    (
      (surety (map-get? Sureties {insuree: insuree, flight-id: flightId}))
      (departure (unwrap! (get departure surety) SURETY_NOT_FOUND))
      (flightStatus (unwrap! (map-get? FlightStatuses {flight-id: flightId, departure: departure}) INVALID_FLIGHT_STATUS))
      (payout (unwrap! (get payouts surety) SURETY_NOT_FOUND))
      (index (index-of (get code payout) flightStatus))
      (amount (default-to u0 (element-at (get amount payout) (default-to u4 index))))
      (flightParameter (unwrap! (map-get? RegisteredFlights flightId) FLIGHT_NOT_FOUND))
      (airline (unwrap! (map-get? RegisteredAirlines (get airline-id flightParameter)) AIRLINE_NOT_FOUND))
      (airlineFund (unwrap! (map-get? AirlinesFund airline) AIRLINE_NOT_FUNDED))
    ) 
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED)
    (asserts! (not (is-eq flightStatus u0)) FLIGHT_STATUS_PENDING)
    (if (is-some index) 
      (begin
        ;; #[filter(airline, insuree, flightId)]
        (map-set AirlinesFund airline (- airlineFund amount))
        (map-delete Sureties {insuree: insuree, flight-id: flightId})
        (try! (as-contract (stx-transfer? amount CONTRACT_ADDRESS insuree)))
        (ok { result: true, message: "Surety has been paid to insuree", flight-status: flightStatus })
      ) 
      (begin
        (map-delete Sureties {insuree: insuree, flight-id: flightId})
        (ok { result: false, message: "No assurance applicable surety removed", flight-status: flightStatus })
      )
    )
  )
)

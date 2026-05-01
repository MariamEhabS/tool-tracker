/**
 * @fileoverview Timezone selection dropdown for time-based QR code restrictions.
 */

interface TimeZoneDropDownProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Dropdown selector for IANA timezones, covering major UTC offsets
 * from UTC-12 through UTC+13.
 * @param value - Currently selected IANA timezone string
 * @param onChange - Callback invoked with the selected timezone value
 */
export const TimeZoneDropDown: React.FC<TimeZoneDropDownProps> = ({
  value,
  onChange,
}) => {
  return (
    <div>
      <label
        htmlFor="timezone-select"
        className="block text-sm font-medium text-gray-700"
      >
        Timezone
      </label>
      <select
        id="timezone-select"
        name="timezone"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 sm:text-sm shadow-sm"
      >
        <option value="Etc/GMT+12">
          (UTC-12:00) International Date Line West
        </option>
        <option value="Pacific/Midway">(UTC-11:00) Midway Island, Samoa</option>
        <option value="Pacific/Honolulu">(UTC-10:00) Hawaii</option>
        <option value="America/Anchorage">(UTC-09:00) Alaska</option>
        <option value="America/Los_Angeles">
          (UTC-08:00) Pacific Time (US & Canada)
        </option>
        <option value="America/Denver">
          (UTC-07:00) Mountain Time (US & Canada)
        </option>
        <option value="America/Chicago">
          (UTC-06:00) Central Time (US & Canada)
        </option>
        <option value="America/New_York" selected>
          (UTC-05:00) Eastern Time (US & Canada)
        </option>
        <option value="America/Caracas">(UTC-04:30) Caracas</option>
        <option value="America/Halifax">
          (UTC-04:00) Atlantic Time (Canada)
        </option>
        <option value="America/Sao_Paulo">(UTC-03:00) Brasilia</option>
        <option value="Atlantic/South_Georgia">(UTC-02:00) Mid-Atlantic</option>
        <option value="Atlantic/Azores">(UTC-01:00) Azores</option>
        <option value="Etc/GMT">
          (UTC+00:00) Greenwich Mean Time : Dublin, Edinburgh, Lisbon, London
        </option>
        <option value="Europe/Berlin">
          (UTC+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna
        </option>
        <option value="Europe/Athens">
          (UTC+02:00) Athens, Bucharest, Istanbul
        </option>
        <option value="Europe/Moscow">
          (UTC+03:00) Moscow, St. Petersburg, Volgograd
        </option>
        <option value="Asia/Dubai">(UTC+04:00) Abu Dhabi, Muscat</option>
        <option value="Asia/Karachi">
          (UTC+05:00) Islamabad, Karachi, Tashkent
        </option>
        <option value="Asia/Dhaka">(UTC+06:00) Astana, Dhaka</option>
        <option value="Asia/Bangkok">
          (UTC+07:00) Bangkok, Hanoi, Jakarta
        </option>
        <option value="Asia/Hong_Kong">
          (UTC+08:00) Beijing, Chongqing, Hong Kong, Urumqi
        </option>
        <option value="Asia/Tokyo">(UTC+09:00) Osaka, Sapporo, Tokyo</option>
        <option value="Australia/Sydney">
          (UTC+10:00) Canberra, Melbourne, Sydney
        </option>
        <option value="Pacific/Guadalcanal">
          (UTC+11:00) Magadan, Solomon Is., New Caledonia
        </option>
        <option value="Pacific/Auckland">
          (UTC+12:00) Auckland, Wellington
        </option>
        <option value="Pacific/Tongatapu">(UTC+13:00) Nuku'alofa</option>
      </select>
      <p className="mt-1 text-xs text-gray-500">
        Select the timezone for time-based restrictions.
      </p>
    </div>
  );
};

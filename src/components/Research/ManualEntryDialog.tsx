import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, Save } from 'lucide-react';

interface ManualEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: any, source: string) => void;
  fieldLabel: string;
  fieldKey: string;
  currentValue?: any;
}

export const ManualEntryDialog: React.FC<ManualEntryDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  fieldLabel,
  fieldKey,
  currentValue,
}) => {
  const { t } = useTranslation('common');
  const [value, setValue] = useState<string>(currentValue ? String(currentValue) : '');
  const [source, setSource] = useState<string>('Manual Override');

  if (!isOpen) return null;

  const handleSave = () => {
    // Basic type inference could go here, but for now passing as string/number usually fine or handled by receiver
    const finalValue = !isNaN(Number(value)) && value.trim() !== '' ? Number(value) : value;
    onSave(finalValue, source);
    onClose();
  };

  return (
    <div className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
      <div className='bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-200'>
        <div className='flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800'>
          <h3 className='text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2'>
            {t('actions.override_title', 'Manual Override')}
          </h3>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='p-6 space-y-4'>
          <div>
            <label className='block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1'>
              {t('general.field', 'Field')}
            </label>
            <div className='p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300'>
              {fieldLabel} <span className='text-xs text-gray-400 ml-2'>({fieldKey})</span>
            </div>
          </div>

          <div>
            <label className='block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1'>
              {t('general.value', 'Value')}
            </label>
            <input
              type='text'
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className='w-full p-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none'
              placeholder={t('actions.enter_value', 'Enter value...')}
              autoFocus
            />
          </div>

          <div>
            <label className='block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1'>
              {t('general.source', 'Source Note')}
            </label>
            <input
              type='text'
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className='w-full p-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none'
              placeholder={t('actions.source_placeholder', 'e.g. Physical check, Catalog page...')}
            />
          </div>

          <div className='pt-4 flex justify-end gap-2'>
            <button
              onClick={onClose}
              className='px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors'
            >
              {t('general.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!value.trim()}
              className='px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all'
            >
              <Save className='w-4 h-4' />
              {t('actions.save', 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
